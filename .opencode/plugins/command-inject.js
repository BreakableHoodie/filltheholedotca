/**
 * Command inject plugin — makes npm scripts available as /commands.
 *
 * Discovers scripts from package.json at session start so developers
 * can run dev, build, test, check, lint, format via slash commands.
 */
export const CommandInject = async ({ project, client, $, directory, worktree }) => {
	return {
		'session.created': async () => {
			const scripts = project.package?.scripts ?? {};
			const commands = Object.entries(scripts)
				.filter(([name]) => !['prepare', 'check:watch'].includes(name))
				.map(([name, cmd]) => ({
					name,
					description: `npm run ${name} — ${cmd}`,
				}));

			if (commands.length > 0) {
				await client.app.log({
					body: {
						service: 'command-inject',
						level: 'info',
						message: `Available commands: /${commands.map((c) => c.name).join(', /')}`,
					},
				});
			}
		},
		'tui.command.execute': async (input, output) => {
			const scripts = project.package?.scripts ?? {};
			const name = input.command?.replace(/^\//, '');
			if (name && scripts[name]) {
				output.preventDefault = true;
				await $`npm run ${name}`;
			}
		},
	};
};
