const { startDesktop } = require('@jjinmak/desktop');
const { WindowsActions, discoverLeagueProcesses } = require('./platform.cjs');
startDesktop({ platform: 'win32', actions: new WindowsActions(), discoverProcesses: discoverLeagueProcesses });
