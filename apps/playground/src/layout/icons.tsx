/** 狭い配置のタブとドロワーのボタンに描く 20px の印。どれも `aria-hidden` にする。 */
const icon = (d: string) => (
  <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 20 20" width="20">
    <path d={d} stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const EDITOR_ICON = icon("M7.5 6L3.5 10l4 4M12.5 6l4 4-4 4");
export const TERMINAL_ICON = icon("M3.5 6l4 4-4 4M9.5 14.5h7");
export const PREVIEW_ICON = icon("M2.75 3.75h14.5v12.5H2.75zM2.75 7.25h14.5");
export const FOLDER_ICON = icon("M2.75 4.75h5l1.5 1.5h8v9h-14.5z");
export const RESULT_ICON = icon(
  "M2.75 3.75h14.5v12.5H2.75zM2.75 8.25h14.5M2.75 12.25h14.5M8.25 8.25v8",
);
export const OUTPUT_ICON = icon("M3.75 4.75h12.5M3.75 8.75h12.5M3.75 12.75h8");
export const NETWORK_ICON = icon("M6.5 3.5v13M3.5 6.5l3-3 3 3M13.5 16.5v-13M10.5 13.5l3 3 3-3");
