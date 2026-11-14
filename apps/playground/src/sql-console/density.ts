import { createContext } from "react";

/** SQL の画面を、ほかのペインと並べるときの詰めた密度で描くか。SqlConsole が渡し、結果の表と操作が読む。 */
export const DenseContext = createContext(false);
