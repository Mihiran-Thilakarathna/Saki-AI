/** Largest file Saki will open (the backend also trims very large editor contexts). */
export const MAX_IMPORT_BYTES = 512 * 1024;

/** File types offered in the "Import file" picker. Anything text-like is accepted. */
export const IMPORT_ACCEPT = [
  '.java', '.kt', '.kts', '.py', '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.dart', '.go', '.rs', '.rb',
  '.php', '.cs', '.cpp', '.cc', '.c', '.h', '.hpp', '.swift', '.sql', '.html', '.htm', '.css', '.scss', '.json',
  '.yaml', '.yml', '.xml', '.md', '.sh', '.txt', '.vue', '.svelte', '.gradle', '.properties', 'Dockerfile',
].join(',');

export interface ImportedFile {
  name: string;
  content: string;
}

/** Reads a local code file as text, rejecting files that are too large or binary. */
export async function readCodeFile(file: File): Promise<ImportedFile> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error(`${file.name} is too large (${Math.round(file.size / 1024)} KB). Saki can open files up to 512 KB.`);
  }
  const content = await file.text();
  // NUL characters mean an image, archive or other binary file.
  if (content.includes('\u0000')) {
    throw new Error(`${file.name} is not a text file. Import source code files only.`);
  }
  return { name: file.name, content };
}
