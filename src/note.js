const fs = require('fs');
const path = require('path');

function getNotePath(projectPath) {
    return path.join(projectPath, 'note.md');
}

async function readNote(projectPath) {
    const notePath = getNotePath(projectPath);
    if (!fs.existsSync(notePath)) {
        return '';
    }
    return fs.readFileSync(notePath, 'utf-8');
}

async function writeNote(projectPath, content) {
    const notePath = getNotePath(projectPath);
    fs.writeFileSync(notePath, content, 'utf-8');
}

async function deleteNote(projectPath) {
    const notePath = getNotePath(projectPath);
    if (fs.existsSync(notePath)) {
        fs.unlinkSync(notePath);
    }
}

function noteExists(projectPath) {
    const notePath = getNotePath(projectPath);
    return fs.existsSync(notePath);
}

module.exports = {
    getNotePath,
    readNote,
    writeNote,
    deleteNote,
    noteExists,
};
