/**
 * True when GitHub rejected adding an item to a Project because it is already there.
 * `addProjectV2ItemById` returns "Content already exists in this project" in that case.
 */
export function isAlreadyInProjectError(message: string): boolean {
  return /content already exists in this project/i.test(message);
}
