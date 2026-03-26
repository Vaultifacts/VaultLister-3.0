// Team Management Routes
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

function safeJsonParse(str, fallback = null) {
    if (str == null) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
}

// Role hierarchy and permissions
const ROLE_HIERARCHY = ['viewer', 'member', 'manager', 'admin', 'owner'];

const ROLE_PERMISSIONS = {
    owner: {
        view_inventory: true,
        edit_inventory: true,
        view_sales: true,
        view_financials: true,
        manage_team: true,
        delete_team: true
    },
    admin: {
        view_inventory: true,
        edit_inventory: true,
        view_sales: true,
        view_financials: true,
        manage_team: true,
        delete_team: false
    },
    manager: {
        view_inventory: true,
        edit_inventory: true,
        view_sales: true,
        view_financials: false,
        manage_team: false,
        delete_team: false
    },
    member: {
        view_inventory: true,
        edit_inventory: true,
        view_sales: false,
        view_financials: false,
        manage_team: false,
        delete_team: false
    },
    viewer: {
        view_inventory: true,
        edit_inventory: false,
        view_sales: false,
        view_financials: false,
        manage_team: false,
        delete_team: false
    }
};

const TIER_LIMITS = {
    free: { max_members: 3, max_teams: 1 },
    starter: { max_members: 5, max_teams: 3 },
    pro: { max_members: 15, max_teams: 10 },
    enterprise: { max_members: 100, max_teams: 50 }
};

export async function teamsRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // GET /api/teams - List user's teams
    if (method === 'GET' && (path === '/' || path === '')) {
        try {
            const teams = await query.all(`
                SELECT t.*, tm.role as user_role,
                       (SELECT COUNT(*) FROM team_members WHERE team_id = t.id AND status = 'active') as member_count
                FROM teams t
                JOIN team_members tm ON t.id = tm.team_id
                WHERE tm.user_id = ? AND tm.status = 'active'
                ORDER BY t.created_at DESC
            `, [user.id]);

            return {
                status: 200,
                data: { teams }
            };
        } catch (error) {
            logger.error('[Teams] Error listing teams', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/teams - Create a new team
    if (method === 'POST' && (path === '/' || path === '')) {
        const { name, description } = body;

        if (!name || typeof name !== 'string' || name.trim().length < 2) {
            return {
                status: 400,
                data: { error: 'Team name must be at least 2 characters' }
            };
        }
        if (name.trim().length > 100) {
            return {
                status: 400,
                data: { error: 'Team name must be 100 characters or fewer' }
            };
        }

        // Check team limit
        const teamCount = await query.get(`
            SELECT COUNT(*) as count FROM teams WHERE owner_user_id = ?
        `, [user.id]);

        const userTier = user.subscription_tier || 'free';
        const limits = TIER_LIMITS[userTier] || TIER_LIMITS.free;

        if (teamCount.count >= limits.max_teams) {
            return {
                status: 403,
                data: {
                    error: 'Team limit reached',
                    message: `Your ${userTier} plan allows up to ${limits.max_teams} team(s). Upgrade to create more.`
                }
            };
        }

        const teamId = uuidv4();
        const memberId = uuidv4();

        try {
            // Create team
            await query.run(`
                INSERT INTO teams (id, name, description, owner_user_id, subscription_tier, max_members)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [teamId, name.trim(), description || null, user.id, userTier, limits.max_members]);

            // Add owner as team member
            await query.run(`
                INSERT INTO team_members (id, team_id, user_id, role, status, accepted_at)
                VALUES (?, ?, ?, 'owner', 'active', NOW())
            `, [memberId, teamId, user.id]);

            // Log activity
            logTeamActivity(teamId, user.id, 'team_created', 'team', teamId, { name }, ctx.ip);

            return {
                status: 201,
                data: {
                    message: 'Team created successfully',
                    team: {
                        id: teamId,
                        name: name.trim(),
                        description,
                        owner_user_id: user.id,
                        user_role: 'owner'
                    }
                }
            };
        } catch (error) {
            return {
                status: 500,
                data: { error: 'Failed to create team' }
            };
        }
    }

    // GET /api/teams/:id - Get team details
    const getTeamMatch = path.match(/^\/([a-f0-9-]+)$/i);
    if (method === 'GET' && getTeamMatch) {
        try {
            const teamId = getTeamMatch[1];

            // Check membership
            const membership = await query.get(`
                SELECT role FROM team_members
                WHERE team_id = ? AND user_id = ? AND status = 'active'
            `, [teamId, user.id]);

            if (!membership) {
                return { status: 403, data: { error: 'Not a member of this team' } };
            }

            // Fix 3: Reject operations on suspended teams
            const suspendedCheck = checkTeamActive(teamId);
            if (suspendedCheck) return suspendedCheck;

            const team = await query.get(`
                SELECT t.*,
                       (SELECT COUNT(*) FROM team_members WHERE team_id = t.id AND status = 'active') as member_count
                FROM teams t WHERE t.id = ?
            `, [teamId]);

            if (!team) {
                return { status: 404, data: { error: 'Team not found' } };
            }

            // Get members
            const members = await query.all(`
                SELECT tm.*, u.email, u.full_name as user_name
                FROM team_members tm
                LEFT JOIN users u ON tm.user_id = u.id
                WHERE tm.team_id = ? AND tm.status = 'active'
                ORDER BY
                    CASE tm.role
                        WHEN 'owner' THEN 1
                        WHEN 'admin' THEN 2
                        WHEN 'manager' THEN 3
                        WHEN 'member' THEN 4
                        WHEN 'viewer' THEN 5
                    END
            `, [teamId]);

            // Get pending invitations if user has permission
            let invitations = [];
            if (hasPermission(membership.role, 'manage_team')) {
                invitations = await query.all(`
                    SELECT * FROM team_invitations
                    WHERE team_id = ? AND status = 'pending' AND expires_at > NOW()
                    ORDER BY created_at DESC
                `, [teamId]);
            }

            return {
                status: 200,
                data: {
                    team: {
                        ...team,
                        user_role: membership.role,
                        permissions: ROLE_PERMISSIONS[membership.role]
                    },
                    members,
                    invitations
                }
            };
        } catch (error) {
            logger.error('[Teams] Error fetching team details', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // PATCH /api/teams/:id - Update team
    const patchTeamMatch = path.match(/^\/([a-f0-9-]+)$/i);
    if (method === 'PATCH' && patchTeamMatch) {
        try {
            const teamId = patchTeamMatch[1];
            const { name, description, settings } = body;

            // Check permission
            const membership = await query.get(`
                SELECT role FROM team_members
                WHERE team_id = ? AND user_id = ? AND status = 'active'
            `, [teamId, user.id]);

            if (!membership || !hasPermission(membership.role, 'manage_team')) {
                return { status: 403, data: { error: 'Permission denied' } };
            }

            // Fix 3: Reject operations on suspended teams
            const suspendedCheck = checkTeamActive(teamId);
            if (suspendedCheck) return suspendedCheck;

            const updates = [];
            const params = [];

            if (name) {
                updates.push('name = ?');
                params.push(name.trim());
            }
            if (description !== undefined) {
                updates.push('description = ?');
                params.push(description);
            }
            if (settings) {
                updates.push('settings = ?');
                params.push(JSON.stringify(settings));
            }

            if (updates.length === 0) {
                return { status: 400, data: { error: 'No updates provided' } };
            }

            updates.push('updated_at = NOW()');
            params.push(teamId);

            await query.run(`UPDATE teams SET ${updates.join(', ')} WHERE id = ?`, params);

            logTeamActivity(teamId, user.id, 'team_updated', 'team', teamId, { updates: Object.keys(body) }, ctx.ip);

            return {
                status: 200,
                data: { message: 'Team updated successfully' }
            };
        } catch (error) {
            logger.error('[Teams] Error updating team', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /api/teams/:id - Delete team
    const deleteTeamMatch = path.match(/^\/([a-f0-9-]+)$/i);
    if (method === 'DELETE' && deleteTeamMatch && !path.slice(1).includes('/')) {
        try {
            const teamId = deleteTeamMatch[1];

            // Only owner can delete
            const team = await query.get('SELECT owner_user_id, is_active FROM teams WHERE id = ?', [teamId]);
            if (!team || team.owner_user_id !== user.id) {
                return { status: 403, data: { error: 'Only the team owner can delete the team' } };
            }

            // Fix 3: Allow delete even when suspended (owner must be able to clean up)
            // No suspended check here — deletion is always permitted by the owner.

            await query.run('DELETE FROM teams WHERE id = ? AND owner_user_id = ?', [teamId, user.id]);

            return {
                status: 200,
                data: { message: 'Team deleted successfully' }
            };
        } catch (error) {
            logger.error('[Teams] Error deleting team', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/teams/:id/invite - Invite member
    const inviteMatch = path.match(/^\/([a-f0-9-]+)\/invite$/i);
    if (method === 'POST' && inviteMatch) {
        try {
            const teamId = inviteMatch[1];
            const { email, role = 'member', message } = body;

            if (!email || typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return { status: 400, data: { error: 'Valid email is required' } };
            }

            // Fix 4: Validate role against allowed invitable values — 'owner' can never be assigned via invitation
            const INVITABLE_ROLES = ['viewer', 'member', 'manager', 'admin'];
            if (!INVITABLE_ROLES.includes(role)) {
                return { status: 400, data: { error: `Invalid role. Must be one of: ${INVITABLE_ROLES.join(', ')}` } };
            }

            // Check permission
            const membership = await query.get(`
                SELECT role FROM team_members
                WHERE team_id = ? AND user_id = ? AND status = 'active'
            `, [teamId, user.id]);

            if (!membership || !hasPermission(membership.role, 'manage_team')) {
                return { status: 403, data: { error: 'Permission denied' } };
            }

            // Fix 3: Reject operations on suspended teams
            const suspendedCheck = checkTeamActive(teamId);
            if (suspendedCheck) return suspendedCheck;

            // Can't invite yourself
            if (email.toLowerCase() === user.email?.toLowerCase()) {
                return { status: 400, data: { error: 'Cannot invite yourself to a team' } };
            }

            // Can't invite with higher role than own
            if (getRoleLevel(role) >= getRoleLevel(membership.role) && membership.role !== 'owner') {
                return { status: 403, data: { error: 'Cannot invite with role equal to or higher than your own' } };
            }

            // Check team member limit
            const team = await query.get('SELECT max_members FROM teams WHERE id = ?', [teamId]);
            const memberCount = await query.get(`
                SELECT COUNT(*) as count FROM team_members WHERE team_id = ? AND status = 'active'
            `, [teamId]);

            if (memberCount.count >= (team?.max_members || 5)) {
                return { status: 403, data: { error: 'Team member limit reached. Upgrade your plan to add more members.' } };
            }

            // Check if already invited or member
            const existing = await query.get(`
                SELECT * FROM team_invitations
                WHERE team_id = ? AND email = ? AND status = 'pending'
            `, [teamId, email.toLowerCase()]);

            if (existing) {
                return { status: 409, data: { error: 'Invitation already sent to this email' } };
            }

            // Check if already a member
            const existingUser = await query.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
            if (existingUser) {
                const existingMember = await query.get(`
                    SELECT * FROM team_members WHERE team_id = ? AND user_id = ?
                `, [teamId, existingUser.id]);
                if (existingMember) {
                    return { status: 409, data: { error: 'User is already a team member' } };
                }
            }

            // Create invitation
            const invitationId = uuidv4();
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

            await query.run(`
                INSERT INTO team_invitations (id, team_id, email, role, token, invited_by, message, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [invitationId, teamId, email.toLowerCase(), role, token, user.id, message || null, expiresAt]);

            logTeamActivity(teamId, user.id, 'member_invited', 'invitation', invitationId, { email, role }, ctx.ip);

            return {
                status: 201,
                data: {
                    message: 'Invitation sent successfully',
                    invitation: {
                        id: invitationId,
                        email,
                        role,
                        expires_at: expiresAt,
                        invite_link: `/join-team?token=${token}`
                    }
                }
            };
        } catch (error) {
            logger.error('[Teams] Error inviting team member', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/teams/join - Accept invitation
    if (method === 'POST' && path === '/join') {
        try {
            const { token } = body;

            if (!token) {
                return { status: 400, data: { error: 'Invitation token is required' } };
            }

            const invitation = await query.get(`
                SELECT ti.*, t.name as team_name
                FROM team_invitations ti
                JOIN teams t ON ti.team_id = t.id
                WHERE ti.token = ? AND ti.status = 'pending' AND ti.expires_at > NOW()
            `, [token]);

            if (!invitation) {
                return { status: 404, data: { error: 'Invalid or expired invitation' } };
            }

            // Fix 3: Reject join if the team is suspended
            const suspendedCheck = checkTeamActive(invitation.team_id);
            if (suspendedCheck) return suspendedCheck;

            // Check if invitation email matches user email
            if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
                return { status: 403, data: { error: 'This invitation was sent to a different email address' } };
            }

            // Re-check team member limit before accepting
            const team = await query.get('SELECT max_members FROM teams WHERE id = ?', [invitation.team_id]);
            const currentCount = await query.get(`
                SELECT COUNT(*) as count FROM team_members WHERE team_id = ? AND status = 'active'
            `, [invitation.team_id]);

            if (team && currentCount.count >= team.max_members) {
                return { status: 403, data: { error: 'Team member limit reached. Contact the team owner to upgrade.' } };
            }

            // Check if already a member
            const existingMember = await query.get(`
                SELECT * FROM team_members WHERE team_id = ? AND user_id = ?
            `, [invitation.team_id, user.id]);

            if (existingMember) {
                // Update status if previously removed
                if (existingMember.status === 'removed') {
                    await query.run(`
                        UPDATE team_members SET status = 'active', role = ?, accepted_at = NOW()
                        WHERE id = ?
                    `, [invitation.role, existingMember.id]);
                } else {
                    return { status: 409, data: { error: 'You are already a member of this team' } };
                }
            } else {
                // Add as new member
                const memberId = uuidv4();
                await query.run(`
                    INSERT INTO team_members (id, team_id, user_id, role, invited_by, status, accepted_at)
                    VALUES (?, ?, ?, ?, ?, 'active', NOW())
                `, [memberId, invitation.team_id, user.id, invitation.role, invitation.invited_by]);
            }

            // Update invitation status
            await query.run(`
                UPDATE team_invitations SET status = 'accepted', responded_at = NOW()
                WHERE id = ?
            `, [invitation.id]);

            logTeamActivity(invitation.team_id, user.id, 'member_joined', 'member', user.id, { role: invitation.role }, ctx.ip);

            return {
                status: 200,
                data: {
                    message: 'Successfully joined the team',
                    team: {
                        id: invitation.team_id,
                        name: invitation.team_name,
                        role: invitation.role
                    }
                }
            };
        } catch (error) {
            logger.error('[Teams] Error joining team', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // PATCH /api/teams/:id/members/:memberId - Update member role
    const updateMemberMatch = path.match(/^\/([a-f0-9-]+)\/members\/([a-f0-9-]+)$/i);
    if (method === 'PATCH' && updateMemberMatch) {
        try {
            const [, teamId, memberId] = updateMemberMatch;
            const { role } = body;

            if (!role || !ROLE_HIERARCHY.includes(role)) {
                return { status: 400, data: { error: 'Invalid role' } };
            }

            // Check permission
            const membership = await query.get(`
                SELECT role FROM team_members
                WHERE team_id = ? AND user_id = ? AND status = 'active'
            `, [teamId, user.id]);

            if (!membership || !hasPermission(membership.role, 'manage_team')) {
                return { status: 403, data: { error: 'Permission denied' } };
            }

            // Fix 3: Reject operations on suspended teams
            const suspendedCheck = checkTeamActive(teamId);
            if (suspendedCheck) return suspendedCheck;

            // Get target member and verify they belong to the same team
            const targetMember = await query.get('SELECT * FROM team_members WHERE id = ? AND team_id = ? AND status = "active"', [memberId, teamId]);
            if (!targetMember) {
                return { status: 404, data: { error: 'Member not found in this team' } };
            }

            // Can't change owner's role
            if (targetMember.role === 'owner') {
                return { status: 403, data: { error: 'Cannot change owner role' } };
            }

            // Can't assign role higher than own
            if (getRoleLevel(role) >= getRoleLevel(membership.role) && membership.role !== 'owner') {
                return { status: 403, data: { error: 'Cannot assign role equal to or higher than your own' } };
            }

            await query.run('UPDATE team_members SET role = ? WHERE id = ?', [role, memberId]);

            logTeamActivity(teamId, user.id, 'member_role_updated', 'member', targetMember.user_id, {
                old_role: targetMember.role,
                new_role: role
            }, ctx.ip);

            return {
                status: 200,
                data: { message: 'Member role updated successfully' }
            };
        } catch (error) {
            logger.error('[Teams] Error updating member role', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /api/teams/:id/members/:memberId - Remove member
    const removeMemberMatch = path.match(/^\/([a-f0-9-]+)\/members\/([a-f0-9-]+)$/i);
    if (method === 'DELETE' && removeMemberMatch) {
        try {
            const [, teamId, memberId] = removeMemberMatch;

            // Check permission
            const membership = await query.get(`
                SELECT role FROM team_members
                WHERE team_id = ? AND user_id = ? AND status = 'active'
            `, [teamId, user.id]);

            if (!membership || !hasPermission(membership.role, 'manage_team')) {
                return { status: 403, data: { error: 'Permission denied' } };
            }

            // Fix 3: Reject operations on suspended teams
            const suspendedCheckRemove = checkTeamActive(teamId);
            if (suspendedCheckRemove) return suspendedCheckRemove;

            // Get target member
            const targetMember = await query.get('SELECT * FROM team_members WHERE id = ? AND team_id = ?', [memberId, teamId]);
            if (!targetMember) {
                return { status: 404, data: { error: 'Member not found' } };
            }

            // Can't remove owner
            if (targetMember.role === 'owner') {
                return { status: 403, data: { error: 'Cannot remove team owner' } };
            }

            // Can't remove someone with higher/equal role (unless owner)
            if (getRoleLevel(targetMember.role) >= getRoleLevel(membership.role) && membership.role !== 'owner') {
                return { status: 403, data: { error: 'Cannot remove member with equal or higher role' } };
            }

            await query.run('UPDATE team_members SET status = ? WHERE id = ?', ['removed', memberId]);

            // Expire any pending invitations for the removed member's email
            const removedUser = await query.get('SELECT email FROM users WHERE id = ?', [targetMember.user_id]);
            if (removedUser) {
                await query.run(`
                    UPDATE team_invitations SET status = 'expired'
                    WHERE team_id = ? AND email = ? AND status = 'pending'
                `, [teamId, removedUser.email.toLowerCase()]);
            }

            logTeamActivity(teamId, user.id, 'member_removed', 'member', targetMember.user_id, { role: targetMember.role }, ctx.ip);

            return {
                status: 200,
                data: { message: 'Member removed successfully' }
            };
        } catch (error) {
            logger.error('[Teams] Error removing team member', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/teams/:id/leave - Leave team
    const leaveMatch = path.match(/^\/([a-f0-9-]+)\/leave$/i);
    if (method === 'POST' && leaveMatch) {
        try {
            const teamId = leaveMatch[1];

            const membership = await query.get(`
                SELECT * FROM team_members
                WHERE team_id = ? AND user_id = ? AND status = 'active'
            `, [teamId, user.id]);

            if (!membership) {
                return { status: 404, data: { error: 'Not a member of this team' } };
            }

            if (membership.role === 'owner') {
                return { status: 403, data: { error: 'Owner cannot leave. Transfer ownership or delete the team.' } };
            }

            await query.run('UPDATE team_members SET status = ? WHERE id = ?', ['removed', membership.id]);

            logTeamActivity(teamId, user.id, 'member_left', 'member', user.id, {}, ctx.ip);

            return {
                status: 200,
                data: { message: 'Successfully left the team' }
            };
        } catch (error) {
            logger.error('[Teams] Error leaving team', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/teams/:id/activity - Get team activity log
    const activityMatch = path.match(/^\/([a-f0-9-]+)\/activity$/i);
    if (method === 'GET' && activityMatch) {
        try {
            const teamId = activityMatch[1];
            const { limit = 50, offset = 0 } = queryParams;

            // Check membership
            const membership = await query.get(`
                SELECT role FROM team_members
                WHERE team_id = ? AND user_id = ? AND status = 'active'
            `, [teamId, user.id]);

            if (!membership) {
                return { status: 403, data: { error: 'Not a member of this team' } };
            }

            // Fix 3: Reject activity reads on suspended teams
            const suspendedCheckActivity = checkTeamActive(teamId);
            if (suspendedCheckActivity) return suspendedCheckActivity;

            const activities = await query.all(`
                SELECT tal.*, u.full_name as user_name, u.email as user_email
                FROM team_activity_log tal
                LEFT JOIN users u ON tal.user_id = u.id
                WHERE tal.team_id = ?
                ORDER BY tal.created_at DESC
                LIMIT ? OFFSET ?
            `, [teamId, parseInt(limit), parseInt(offset)]);

            return {
                status: 200,
                data: {
                    activities: activities.map(a => ({
                        ...a,
                        details: safeJsonParse(a.details, null)
                    }))
                }
            };
        } catch (error) {
            logger.error('[Teams] Error fetching team activity log', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/teams/permissions - Get role permissions matrix
    if (method === 'GET' && path === '/permissions') {
        return {
            status: 200,
            data: {
                roles: ROLE_HIERARCHY,
                permissions: ROLE_PERMISSIONS
            }
        };
    }

    return {
        status: 404,
        data: { error: 'Not found' }
    };
}

// Helper functions
function hasPermission(role, permission) {
    return ROLE_PERMISSIONS[role]?.[permission] === true;
}

// Returns a 403 response object if the team is suspended/deactivated, otherwise null.
async function checkTeamActive(teamId) {
    const team = await query.get('SELECT is_active FROM teams WHERE id = ?', [teamId]);
    if (!team) return { status: 404, data: { error: 'Team not found' } };
    if (!team.is_active) return { status: 403, data: { error: 'This team has been suspended and cannot perform operations' } };
    return null;
}

function getRoleLevel(role) {
    return ROLE_HIERARCHY.indexOf(role);
}

async function logTeamActivity(teamId, userId, action, resourceType, resourceId, details, ipAddress = null) {
    try {
        const id = uuidv4();
        await query.run(`
            INSERT INTO team_activity_log (id, team_id, user_id, action, resource_type, resource_id, details, ip_address)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, teamId, userId, action, resourceType, resourceId, JSON.stringify(details), ipAddress]);
    } catch (e) {
        // Non-critical, don't fail the main operation
        logger.error('[Teams] Failed to log team activity', null, { detail: e.message });
    }
}

// Middleware helper for checking team permissions in other routes
export function checkTeamPermission(permission) {
    return async (ctx) => {
        const { user, teamId } = ctx;
        if (!teamId) return true; // No team context, allow

        const membership = await query.get(`
            SELECT role FROM team_members
            WHERE team_id = ? AND user_id = ? AND status = 'active'
        `, [teamId, user.id]);

        if (!membership) {
            return { status: 403, data: { error: 'Not a member of this team' } };
        }

        if (!hasPermission(membership.role, permission)) {
            return { status: 403, data: { error: 'Permission denied' } };
        }

        ctx.teamRole = membership.role;
        ctx.teamPermissions = ROLE_PERMISSIONS[membership.role];
        return true;
    };
}
