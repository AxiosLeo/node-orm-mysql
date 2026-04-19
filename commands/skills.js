'use strict';

const fs = require('fs');
const path = require('path');
const { Command, printer } = require('@axiosleo/cli-tool');
const { _exists, _copy, _read, _read_json, _mkdir } = require('@axiosleo/cli-tool/src/helper/fs');

const SKILL_FILES = [
  'SKILL.md',
  'query-building.md',
  'where-conditions.md',
  'crud-operations.md',
  'transactions.md',
];

const SUPPORTED_TARGETS = ['cursor', 'claude', 'windsurf'];

const PKG_NAME = '@axiosleo/orm-mysql';

function getTargetDir(cwd, target) {
  const map = {
    cursor: path.join(cwd, '.cursor', 'skills', 'orm-mysql-usage'),
    windsurf: path.join(cwd, '.windsurf', 'skills', 'orm-mysql-usage'),
  };
  return map[target] || null;
}

async function resolveSkillsSource(cwd) {
  const localPkgJson = path.join(cwd, 'node_modules', PKG_NAME, 'package.json');
  let localPkgFound = false;
  let localVersion = null;

  if (await _exists(localPkgJson)) {
    localPkgFound = true;
    const pkg = await _read_json(localPkgJson);
    localVersion = pkg.version;
    const skillsDir = path.join(cwd, 'node_modules', PKG_NAME, 'skills');
    if (await _exists(skillsDir)) {
      return { dir: skillsDir, version: localVersion, local: true, outdated: false };
    }
  }

  const fallbackDir = path.join(__dirname, '..', 'skills');
  if (await _exists(fallbackDir)) {
    const fallbackPkg = path.join(__dirname, '..', 'package.json');
    let version = 'unknown';
    if (await _exists(fallbackPkg)) {
      const pkg = await _read_json(fallbackPkg);
      version = pkg.version;
    }
    return {
      dir: fallbackDir,
      version,
      local: false,
      outdated: localPkgFound,
      localVersion,
    };
  }
  return null;
}

class SkillsCommand extends Command {
  constructor() {
    super({
      name: 'skills',
      desc: 'Install or uninstall AI skills for coding assistants (Cursor, Claude Code, Windsurf)',
    });
    this.addOption('install', 'i', 'Install skills for target tool (cursor, claude, windsurf)', 'optional', '');
    this.addOption('uninstall', 'u', 'Uninstall skills for target tool (cursor, claude, windsurf)', 'optional', '');
  }

  async exec(args, options) {
    const install = options.install;
    const uninstall = options.uninstall;

    if (!install && !uninstall) {
      this.printUsage();
      return;
    }

    if (install) {
      await this.install(install);
    } else if (uninstall) {
      await this.uninstall(uninstall);
    }
  }

  printUsage() {
    printer.println();
    printer.println('Usage:');
    printer.println('  orm-mysql skills --install=<target>     Install AI skills');
    printer.println('  orm-mysql skills --uninstall=<target>   Uninstall AI skills');
    printer.println();
    printer.println('Supported targets: ' + SUPPORTED_TARGETS.join(', '));
    printer.println();
    printer.println('Examples:');
    printer.println('  npx @axiosleo/orm-mysql skills --install=cursor');
    printer.println('  npx @axiosleo/orm-mysql skills --install=claude');
    printer.println('  npx @axiosleo/orm-mysql skills --uninstall=cursor');
    printer.println();
  }

  async install(target) {
    if (!SUPPORTED_TARGETS.includes(target)) {
      printer.error(`Unsupported target: "${target}". Supported targets: ${SUPPORTED_TARGETS.join(', ')}`);
      return;
    }

    const cwd = process.cwd();
    const source = await resolveSkillsSource(cwd);

    if (!source) {
      printer.error('Could not find skills files. Please reinstall @axiosleo/orm-mysql.');
      return;
    }

    if (source.local) {
      printer.info(`Found ${PKG_NAME}@${source.version} in node_modules`);
    } else if (source.outdated) {
      printer.warning(`${PKG_NAME}@${source.localVersion} is installed locally but does not include skills files.`);
      printer.warning('Skills files are available since v0.15.0. Please update:');
      printer.warning(`  npm install ${PKG_NAME}@latest`);
      printer.println();
      printer.info(`Using skills from npx ${PKG_NAME}@${source.version} instead.`);
    } else {
      printer.warning(`${PKG_NAME} is not installed locally in this project.`);
      printer.warning(`Consider running: npm install ${PKG_NAME}`);
      printer.println();
    }

    printer.info(`Installing skills for ${target} from ${PKG_NAME}@${source.version}...`);

    if (target === 'claude') {
      await this.installClaude(cwd, source);
    } else {
      await this.installCopyTarget(cwd, target, source);
    }
  }

  async installCopyTarget(cwd, target, source) {
    const targetDir = getTargetDir(cwd, target);
    await _mkdir(targetDir);
    await _copy(source.dir, targetDir, true);
    printer.success(`Skills installed to ${path.relative(cwd, targetDir)}/`);
    printer.println();
    printer.println('Files installed:');
    for (const file of SKILL_FILES) {
      printer.println(`  - ${file}`);
    }
    printer.println();
  }

  async installClaude(cwd, source) {
    const claudeFile = path.join(cwd, 'CLAUDE.md');
    const header = `<!-- ${PKG_NAME}@${source.version} skills -->\n`;
    const separator = '\n---\n\n';

    let content = header;
    for (const file of SKILL_FILES) {
      const filePath = path.join(source.dir, file);
      if (await _exists(filePath)) {
        const fileContent = await _read(filePath);
        content += separator + fileContent.trim() + '\n';
      }
    }

    if (await _exists(claudeFile)) {
      const existing = await _read(claudeFile);
      if (existing.includes(`<!-- ${PKG_NAME}`) && existing.includes('skills -->')) {
        printer.warning('CLAUDE.md already contains @axiosleo/orm-mysql skills.');
        printer.warning('Please remove the existing skills section first, or run:');
        printer.warning('  npx @axiosleo/orm-mysql skills --uninstall=claude');
        return;
      }
    }

    fs.appendFileSync(claudeFile, '\n' + content);
    printer.success(`Skills appended to ${path.relative(cwd, claudeFile)}`);
    printer.println();
  }

  async uninstall(target) {
    if (!SUPPORTED_TARGETS.includes(target)) {
      printer.error(`Unsupported target: "${target}". Supported targets: ${SUPPORTED_TARGETS.join(', ')}`);
      return;
    }

    const cwd = process.cwd();

    if (target === 'claude') {
      this.uninstallClaude(cwd);
      return;
    }

    const targetDir = getTargetDir(cwd, target);
    if (await _exists(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      printer.success(`Skills removed from ${path.relative(cwd, targetDir)}/`);
    } else {
      printer.warning(`No skills found at ${path.relative(cwd, targetDir)}/`);
    }
  }

  uninstallClaude(cwd) {
    const claudeFile = path.join(cwd, 'CLAUDE.md');
    if (!fs.existsSync(claudeFile)) {
      printer.warning('CLAUDE.md not found.');
      return;
    }
    const content = fs.readFileSync(claudeFile, 'utf8');
    const startMarker = `<!-- ${PKG_NAME}`;
    const idx = content.indexOf(startMarker);
    if (idx === -1) {
      printer.warning('No @axiosleo/orm-mysql skills section found in CLAUDE.md.');
      return;
    }
    const cleaned = content.substring(0, idx).trimEnd() + '\n';
    fs.writeFileSync(claudeFile, cleaned);
    printer.success('Skills section removed from CLAUDE.md');
  }
}

module.exports = SkillsCommand;
