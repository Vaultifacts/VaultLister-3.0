// Seed Help & Support Content
// Video tutorials, FAQs, and knowledge base articles

import { query } from '../database.js';

export async function seedHelpContent() {
    console.log('Seeding help content...');

    // Video Tutorials
    const videos = [
        {
            id: 'vid_getting_started',
            title: 'Getting Started with VaultLister',
            description: 'Learn the basics of VaultLister in this quick 5-minute tutorial',
            video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Replace with actual video
            category: 'getting_started',
            duration: 300,
            thumbnail_url: null,
            view_count: 0,
            position: 1
        },
        {
            id: 'vid_add_inventory',
            title: 'How to Add Inventory Items',
            description: 'Step-by-step guide to adding items to your inventory',
            video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
            category: 'inventory',
            duration: 420,
            thumbnail_url: null,
            view_count: 0,
            position: 2
        },
        {
            id: 'vid_cross_list',
            title: 'Cross-Listing to Multiple Platforms',
            description: 'Learn how to cross-list items to Poshmark, eBay, and more',
            video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
            category: 'cross_listing',
            duration: 600,
            thumbnail_url: null,
            view_count: 0,
            position: 3
        },
        {
            id: 'vid_automations',
            title: 'Setting Up Automations',
            description: 'Automate sharing, following, and offers on Poshmark',
            video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
            category: 'automations',
            duration: 480,
            thumbnail_url: null,
            view_count: 0,
            position: 4
        },
        {
            id: 'vid_image_bank',
            title: 'Using the Image Bank',
            description: 'Organize and edit your product images efficiently',
            video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
            category: 'advanced',
            duration: 390,
            thumbnail_url: null,
            view_count: 0,
            position: 5
        }
    ];

    for (const video of videos) {
        try {
            await query.run(
                `INSERT INTO help_videos (id, title, description, video_url, category, duration, thumbnail_url, view_count, position)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT DO NOTHING`,
                [video.id, video.title, video.description, video.video_url, video.category, video.duration, video.thumbnail_url, video.view_count, video.position]
            );
        } catch (error) {
            console.error(`Failed to insert video ${video.id}:`, error);
        }
    }

    // FAQs
    const faqs = [
        {
            id: 'faq_what_is_vaultlister',
            question: 'What is VaultLister?',
            answer: 'VaultLister is a comprehensive multi-channel reselling platform that helps you manage inventory, cross-list items to multiple marketplaces, automate repetitive tasks, and track your sales analytics.',
            category: 'general',
            position: 1
        },
        {
            id: 'faq_supported_platforms',
            question: 'Which platforms does VaultLister support?',
            answer: 'VaultLister supports Poshmark, eBay, Mercari, Depop, Grailed, Facebook Marketplace, and Etsy. You can list items to all platforms from a single interface.',
            category: 'platforms',
            position: 2
        },
        {
            id: 'faq_how_to_add_item',
            question: 'How do I add an item to my inventory?',
            answer: 'Click the "Add Item" button on the Inventory page, fill out the product details (title, brand, price, etc.), upload images, and click Save. You can also use the AI Generate feature to create listings from product images.',
            category: 'inventory',
            position: 3
        },
        {
            id: 'faq_cross_listing',
            question: 'How does cross-listing work?',
            answer: 'Select items from your inventory, click "Cross-List", choose the platforms you want to list to, and optionally adjust prices for each platform. VaultLister will create listings on all selected platforms simultaneously.',
            category: 'platforms',
            position: 4
        },
        {
            id: 'faq_automations',
            question: 'What can I automate with VaultLister?',
            answer: 'You can automate Poshmark sharing, following, and offers. Set up automation rules to share your closet automatically, follow users, and send offers to likers on a schedule.',
            category: 'automations',
            position: 5
        },
        {
            id: 'faq_image_bank',
            question: 'What is the Image Bank?',
            answer: 'The Image Bank is a centralized storage for all your product images. Organize images into folders, add tags for easy searching, and reuse images across multiple listings. Includes a built-in photo editor for quick adjustments.',
            category: 'inventory',
            position: 6
        },
        {
            id: 'faq_pricing',
            question: 'Is VaultLister free?',
            answer: 'VaultLister offers a free tier with core features. Premium tiers unlock advanced features like unlimited automations, AI listing generation, and priority support.',
            category: 'general',
            position: 7
        },
        {
            id: 'faq_data_privacy',
            question: 'Is my data safe?',
            answer: 'Yes, all your data is stored locally on your device by default. We use industry-standard encryption for any data transmitted to third-party platforms. Your inventory and sales data is never shared without your permission.',
            category: 'general',
            position: 8
        },
        {
            id: 'faq_templates',
            question: 'What are listing templates?',
            answer: 'Templates save your preferred listing configurations (title patterns, descriptions, tags, pricing strategies) so you can quickly create similar listings. Great for items in the same category or from the same brand.',
            category: 'inventory',
            position: 9
        },
        {
            id: 'faq_chrome_extension',
            question: 'What does the Chrome Extension do?',
            answer: 'The Chrome Extension lets you quickly capture products from Amazon and Nordstrom, track competitor prices, and auto-fill marketplace listing forms with your VaultLister inventory.',
            category: 'advanced',
            position: 10
        }
    ];

    for (const faq of faqs) {
        try {
            await query.run(
                `INSERT INTO help_faq (id, question, answer, category, position)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT DO NOTHING`,
                [faq.id, faq.question, faq.answer, faq.category, faq.position]
            );
        } catch (error) {
            console.error(`Failed to insert FAQ ${faq.id}:`, error);
        }
    }

    // Knowledge Base Articles
    const articles = [
        {
            id: 'art_getting_started_guide',
            title: 'Getting Started Guide',
            slug: 'getting-started-guide',
            content: `# Getting Started with VaultLister

Welcome to VaultLister! This guide will help you get up and running quickly.

## Step 1: Add Your First Item
Navigate to the Inventory page and click "Add Item". Fill out the product details including:
- Title (required)
- Brand, category, size, color
- Cost price and list price
- Upload product images

## Step 2: Connect Your Platforms
Go to My Shops and connect your marketplace accounts (Poshmark, eBay, Mercari, etc.). You can use OAuth for secure authentication or manually enter API credentials.

## Step 3: Cross-List Your Item
Select items from your inventory and click "Cross-List". Choose which platforms to list to and adjust prices if needed.

## Step 4: Set Up Automations
Visit the Automations page to set up automated sharing, following, and offers on Poshmark. This saves you hours of manual work!`,
            category: 'guides',
            tags: JSON.stringify(['getting-started', 'beginner', 'tutorial']),
            is_published: 1
        },
        {
            id: 'art_cross_listing_best_practices',
            title: 'Cross-Listing Best Practices',
            slug: 'cross-listing-best-practices',
            content: `# Cross-Listing Best Practices

Maximize your sales by following these cross-listing tips.

## Choose the Right Platforms
Not all items sell well on all platforms. Consider:
- Poshmark: Fashion, accessories, home goods
- eBay: Electronics, collectibles, vintage items
- Mercari: Everything! Great all-around platform
- Depop: Trendy fashion, streetwear
- Grailed: Men's fashion, sneakers

## Optimize Pricing for Each Platform
Each platform has different fees and buyer expectations. Use the Advanced Cross-List mode to adjust prices per platform:
- Poshmark: 20% commission - price accordingly
- eBay: 13% average fees - competitive pricing wins
- Mercari: 10% commission - slight discount works well

## Customize Titles and Descriptions
While unified mode is faster, customizing for each platform can improve visibility:
- Use platform-specific keywords
- Adjust character limits (eBay has more space)
- Include relevant hashtags for Poshmark/Instagram`,
            category: 'guides',
            tags: JSON.stringify(['cross-listing', 'best-practices', 'sales']),
            is_published: 1
        },
        {
            id: 'art_automation_setup',
            title: 'Setting Up Poshmark Automations',
            slug: 'poshmark-automation-setup',
            content: `# Setting Up Poshmark Automations

Automate your Poshmark activity to save time and increase sales.

## Available Automation Types
1. Auto-Share: Share your entire closet on a schedule
2. Auto-Follow: Follow users who like your items
3. Auto-Offer: Send offers to likers automatically

## Best Practices
- Share your closet 2-3 times per day
- Follow users during peak hours (evening/weekends)
- Send offers within 24 hours of a like
- Use realistic schedules to avoid looking like a bot

## Setting Up Rules
1. Go to Automations page
2. Enable the automations you want
3. Configure schedule and conditions
4. Save and activate

Automations run in the background while you focus on other tasks!`,
            category: 'tutorials',
            tags: JSON.stringify(['automations', 'poshmark', 'efficiency']),
            is_published: 1
        },
        {
            id: 'art_troubleshooting_oauth',
            title: 'Troubleshooting OAuth Connection Issues',
            slug: 'troubleshooting-oauth',
            content: `# Troubleshooting OAuth Connection Issues

Having trouble connecting your marketplace accounts? Try these solutions.

## Common Issues
1. Popup Blocked: Allow popups for VaultLister in your browser settings
2. Connection Timeout: Check your internet connection and try again
3. Invalid Credentials: Make sure you're logging in with the correct account

## Steps to Resolve
- Clear browser cache and cookies
- Disable browser extensions temporarily
- Try using incognito/private mode
- Contact support if issues persist

## Manual Connection Alternative
If OAuth isn't working, you can use manual connection with API keys instead.`,
            category: 'troubleshooting',
            tags: JSON.stringify(['oauth', 'troubleshooting', 'connection']),
            is_published: 1
        }
    ];

    for (const article of articles) {
        try {
            await query.run(
                `INSERT INTO help_articles (id, title, slug, content, category, tags, is_published)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT DO NOTHING`,
                [article.id, article.title, article.slug, article.content, article.category, article.tags, article.is_published]
            );
        } catch (error) {
            console.error(`Failed to insert article ${article.id}:`, error);
        }
    }

    console.log('✓ Help content seeded successfully');
}
