// 精致深色设计风（Linear / shadcn 风格，Naive UI 覆盖）
export const appThemeOverrides = {
  common: {
    fontFamily: 'Inter, "Noto Sans SC", system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif',
    fontFamilyMono: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
    fontWeightStrong: '600',

    primaryColor: '#7c6cff',
    primaryColorHover: '#9385ff',
    primaryColorPressed: '#6a5ae0',
    primaryColorSuppl: '#9385ff',

    infoColor: '#5b8cff',
    successColor: '#3ecf8e',
    warningColor: '#e6b450',
    errorColor: '#f56c6c',

    borderRadius: '10px',
    borderRadiusSmall: '7px',

    textColorBase: '#ededf2',
    textColor1: '#f4f4f7',
    textColor2: 'rgba(237, 237, 242, 0.88)',
    textColor3: 'rgba(237, 237, 242, 0.5)',
    placeholderColor: 'rgba(237, 237, 242, 0.38)',

    bodyColor: 'rgba(0, 0, 0, 0)',
    cardColor: 'rgba(22, 22, 28, 0.7)',
    modalColor: '#16161c',
    popoverColor: '#1a1a22',
    tableColor: 'rgba(22, 22, 28, 0.5)',
    tableHeaderColor: 'rgba(32, 32, 40, 0.7)',

    borderColor: 'rgba(255, 255, 255, 0.09)',
    dividerColor: 'rgba(255, 255, 255, 0.07)',

    inputColor: 'rgba(255, 255, 255, 0.04)',
    inputColorDisabled: 'rgba(255, 255, 255, 0.02)',
    actionColor: 'rgba(255, 255, 255, 0.04)',
    hoverColor: 'rgba(124, 108, 255, 0.1)',
    pressedColor: 'rgba(124, 108, 255, 0.16)',

    boxShadow2: '0 12px 40px rgba(0, 0, 0, 0.55)',
  },
  Button: {
    textColorPrimary: '#ffffff',
    textColorHoverPrimary: '#ffffff',
    textColorPressedPrimary: '#ffffff',
    textColorFocusPrimary: '#ffffff',
    fontWeight: '500',
  },
  Card: {
    borderRadius: '14px',
  },
  Tabs: {
    tabTextColorActiveLine: '#9385ff',
    tabTextColorHoverLine: '#9385ff',
    barColor: '#7c6cff',
  },
  Tag: {
    borderRadius: '8px',
  },
  Input: {
    boxShadowFocus: '0 0 0 2px rgba(124, 108, 255, 0.22)',
    borderHover: '1px solid rgba(124, 108, 255, 0.5)',
    borderFocus: '1px solid #7c6cff',
  },
}
