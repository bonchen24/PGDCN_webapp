// Author: Gemini
// OS support: Web/Node
// Description: Test-only Node preload that avoids the host userInfo ENOMEM failure

const os = require('node:os');

os.userInfo = () => ({ username: 'codex' });

// --- End of test-node-userinfo-preload.cjs ---
