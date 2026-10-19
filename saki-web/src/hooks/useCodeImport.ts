import { readCodeFile } from '@/lib/fileImport';
import { toast } from '@/store/toastStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

/** Opens a local code file in the editor (Saki reads the editor with every question). */
export async function importCodeFile(file: File): Promise<boolean> {
  if (!useWorkspaceStore.getState().activeSessionId) {
    toast.error('Open a chat first, then import a file.');
    return false;
  }
  try {
    const { name, content } = await readCodeFile(file);
    useWorkspaceStore.getState().importFile(name, content);
    toast.success(`Opened ${name}. Ask Saki anything about it.`);
    return true;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not open that file.');
    return false;
  }
}
