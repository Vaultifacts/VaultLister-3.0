export default {
    extends: ['@commitlint/config-conventional'],
    parserPreset: {
        parserOpts: {
            headerPattern: /^(?:\[AUTO\] )?(\w+)(?:\((.+)\))?: (.+)$/,
            headerCorrespondence: ['type', 'scope', 'subject'],
        },
    },
    rules: {
        'subject-case': [0],
        'body-max-line-length': [0],
        'header-max-length': [2, 'always', 120],
    },
};
