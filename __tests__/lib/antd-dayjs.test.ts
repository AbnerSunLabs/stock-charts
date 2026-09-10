import dayjs from '@/lib/antd-dayjs';

describe('antd-dayjs', () => {
  it('应提供 rc-picker DatePicker 打开面板所需的 weekday/localeData', () => {
    const clone = dayjs().locale('en');
    expect(typeof clone.weekday).toBe('function');
    expect(typeof clone.localeData).toBe('function');
    expect(() => clone.weekday() + clone.localeData().firstDayOfWeek()).not.toThrow();
  });
});
