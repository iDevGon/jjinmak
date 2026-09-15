const { startDesktop } = require('@jjinmak/desktop');
const { MacActions, discoverLeagueProcesses } = require('./platform.cjs');
startDesktop({ platform: 'darwin', actions: new MacActions(), discoverProcesses: discoverLeagueProcesses });
