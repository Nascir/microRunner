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
  start       Scan sprites and start the server
  import      Import a project from microStudio ZIP file
  export      Export project to microStudio compatible ZIP
  backup      Create a backup of the project
  version     Show version

Examples:
  mkdir my-awesome-game
  cd my-awesome-game
  microrunner init
  microrunner start
`);
}

module.exports = { showHelp };
