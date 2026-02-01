const BANNER = `
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║     ██▄██ █ ▄▀▀ █▀▄ ▄▀▄ █▀▄ █ █ █▄ █ █▄ █ ██▀ █▀▄     ║
║     █ ▀ █ █ ▀▄▄ █▀▄ ▀▄▀ █▀▄ ▀▄█ █ ▀█ █ ▀█ █▄▄ █▀▄     ║
║                                                       ║
║       Local microScript development environment       ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
`;

function showHelp() {
  console.log(BANNER);
  console.log(`Usage: microrunner <command>

Commands:
  init        Initialize a new project in current folder
  start       Scan sprites, start server and open browser
  backup      Create project backup
  import      Create project from microStudio ZIP file
  export      Export project to microStudio ZIP file
  version     Show version

Examples:
  microrunner init
  microrunner start
`);
}

module.exports = { showHelp };
