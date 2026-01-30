function showHelp() {
  console.log(`microRunner - Local microScript development environment

Usage: microrunner <command>

Commands:
  init           Initialize a new project in current folder
  start          Scan sprites and start the server
  import         Import a project from microStudio ZIP file
  export         Export project to microStudio compatible ZIP
  backup         Create a backup of the project
  version        Show version
  help           Show this help

Examples:
  cd ~/projects/my-game
  microrunner init
  microrunner start
 `);
}

module.exports = { showHelp };
