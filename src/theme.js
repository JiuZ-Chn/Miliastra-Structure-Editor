// 深墨紫主题，配色参考 gi.nanoka.cc 的语义色阶。
export const appThemeOverrides = {
  common: {
    fontFamily: 'Sora, "Noto Sans SC", system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif',
    fontFamilyMono: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
    fontWeightStrong: '600',

    primaryColor: '#b892ff',
    primaryColorHover: '#c7aaff',
    primaryColorPressed: '#9f73e8',
    primaryColorSuppl: '#ff79cf',

    infoColor: '#7dd3fc',
    successColor: '#6ee7b7',
    warningColor: '#fcd34d',
    errorColor: '#fda4af',

    borderRadius: '8px',
    borderRadiusSmall: '6px',

    textColorBase: '#f8fafc',
    textColor1: '#f8fafc',
    textColor2: '#cbd5e1',
    textColor3: '#94a3b8',
    placeholderColor: 'rgba(148, 163, 184, 0.68)',

    bodyColor: 'rgba(0, 0, 0, 0)',
    cardColor: 'rgba(18, 13, 34, 0.88)',
    modalColor: '#120d22',
    popoverColor: '#1b1431',
    tableColor: 'rgba(18, 13, 34, 0.82)',
    tableHeaderColor: 'rgba(27, 20, 49, 0.92)',

    borderColor: 'rgba(112, 91, 146, 0.58)',
    dividerColor: 'rgba(112, 91, 146, 0.36)',

    inputColor: '#1b1431',
    inputColorDisabled: '#120d22',
    actionColor: '#1b1431',
    hoverColor: 'rgba(184, 146, 255, 0.12)',
    pressedColor: 'rgba(184, 146, 255, 0.2)',

    boxShadow2: '0 14px 42px rgba(0, 0, 0, 0.48)',
  },
  Button: {
    textColorPrimary: '#120d22',
    textColorHoverPrimary: '#120d22',
    textColorPressedPrimary: '#120d22',
    textColorFocusPrimary: '#120d22',
    fontWeight: '600',
    heightSmall: '30px',
  },
  Card: {
    borderRadius: '8px',
  },
  Tabs: {
    tabTextColorActiveLine: '#b892ff',
    tabTextColorHoverLine: '#c7aaff',
    barColor: '#b892ff',
  },
  Tag: {
    borderRadius: '6px',
    heightSmall: '22px',
  },
  Input: {
    heightSmall: '30px',
    boxShadowFocus: '0 0 0 2px rgba(184, 146, 255, 0.2)',
    borderHover: '1px solid rgba(184, 146, 255, 0.68)',
    borderFocus: '1px solid #b892ff',
  },
}
