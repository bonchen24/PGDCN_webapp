// Author: Codex
// Description: Start the native development server explicitly in the PCN profile.

process.env.APP_PROFILE = 'pcn';
require('./native-dev.cjs');
