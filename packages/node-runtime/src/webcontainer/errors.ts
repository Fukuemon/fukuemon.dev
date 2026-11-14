import { PathNotFoundError } from "../backend";

/**
 * WebContainers の fs の失敗を、BackendFiles の契約の失敗に変える。パスが無いときは PathNotFoundError を、ほかは受け取った値を返す。
 * WebContainers の失敗には code が無く、パスが無いことは message の先頭の `ENOENT:` でしか分けられない (ADR-0069)。
 */
export const toBackendError = (error: unknown): unknown =>
  error instanceof Error && error.message.startsWith("ENOENT:")
    ? new PathNotFoundError(error.message, { cause: error })
    : error;
