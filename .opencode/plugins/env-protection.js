/**
 * Env protection plugin — prevents opencode from reading or editing
 * sensitive .env* files, while still allowing safe inspection (key names
 * only, never values).
 *
 * Based on the opencode docs example and EnvSitter Guard pattern.
 */
export const EnvProtection = async ({ project, client, $, directory, worktree }) => {
	return {
		'tool.execute.before': async (input, output) => {
			if (input.tool === 'read' && output.args.filePath?.includes('.env')) {
				throw new Error(
					'Reading .env files is not allowed. Use `npm run check:env` to verify env vars are set.',
				);
			}
			if (
				input.tool === 'edit' &&
				output.args.filePath?.includes('.env') &&
				!output.args.filePath?.endsWith('.env.example')
			) {
				throw new Error('Editing .env files is not allowed. Update .env.example instead.');
			}
			if (
				input.tool === 'write' &&
				output.args.filePath?.includes('.env') &&
				!output.args.filePath?.endsWith('.env.example')
			) {
				throw new Error('Writing .env files is not allowed. Update .env.example instead.');
			}
		},
	};
};
