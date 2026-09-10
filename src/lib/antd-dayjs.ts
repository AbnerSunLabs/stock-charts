import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import localeData from 'dayjs/plugin/localeData';
import weekday from 'dayjs/plugin/weekday';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import weekYear from 'dayjs/plugin/weekYear';

/**
 * 注册 Ant Design DatePicker 依赖的 dayjs 插件。
 * 打开日历时 rc-picker 会对表单里的 dayjs 值调用 weekday / localeData；
 * 应用 import 的 dayjs 与 antd 内部那份可能不是同一实例，必须在写入表单值前扩展。
 */
export function registerAntdDayjsPlugins(): void {
  dayjs.extend(customParseFormat);
  dayjs.extend(advancedFormat);
  dayjs.extend(weekday);
  dayjs.extend(localeData);
  dayjs.extend(weekOfYear);
  dayjs.extend(weekYear);
  dayjs.locale('zh-cn');
}

registerAntdDayjsPlugins();

export default dayjs;
export type { Dayjs } from 'dayjs';
