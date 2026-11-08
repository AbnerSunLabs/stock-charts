/** E 大公开帖里给出的指数判断点位。区间展示原文范围，阶梯按下沿定位。 */

export interface IndexLevelMark {
  name: string;
  point: number;
  label: string;
}

export interface IndexQuote {
  postId: number;
  date: string;
  level: string;
  text: string;
  /** 微博原文。缺省时用且慢帖 id。 */
  url?: string;
  image?: string;
}

export interface IndexChartEtf {
  code: string;
  name: string;
}

export interface IndexWatch {
  code: string;
  name: string;
  levels: IndexLevelMark[];
  quotes: IndexQuote[];
  /** 仪表盘的中枢点位。缺省时取最贴近区间中值的那个点位；弧线两端始终是最低与最高点位。 */
  gauge?: { mid: number };
  /** 指数折线之外，再加这只 ETF 的全部收盘。 */
  chartEtf?: IndexChartEtf;
  /** 再加一只场外基金的单位净值。 */
  chartFund?: IndexChartEtf;
  /** 指数折线下再加招行美元汇买、汇卖，按 1 美元计。 */
  chartBankFx?: boolean;
}

const POST = (postId: number) =>
  `https://qieman.com/content/content-detail?postId=${postId}`;

export function quoteUrl(postId: number): string {
  return POST(postId);
}

export function quoteHref(quote: IndexQuote): string {
  return quote.url ?? quoteUrl(quote.postId);
}

export const INDEX_WATCHES: IndexWatch[] = [
  {
    code: '000905.SH',
    name: '中证500',
    levels: [
      { name: '外太空', point: 8500, label: '8500' },
      { name: '钻石坑', point: 4800, label: '4800' },
    ],
    quotes: [
      {
        postId: 92515,
        date: '2026-10-20',
        level: '钻石坑 4800',
        text: '2023年2月，我估算的中证500外太空点位是8100点。\n\n当时是6200点，后来最低跌到了4200点。\n\n2026年1月，中证500在2015年以后首次突破8100点。由于时间已经过了3年多，点位每年会有些许上浮，所以我又等了一等。\n\n再涨几百点后，我开始按照3年多前的预判果断减仓。\n\n知行合一。\n\n现在，中证500从最高9100点，跌回了6800点。\n\n今天，我再给一个钻石坑点位。如果能到，我会在那个附近把宽基仓位配置完毕。\n\n以今天的指数看，中证500在4800点左右，又是一个完美配置位置。不是说必然到，而是说到了的话，不要犹豫。\n\n注意，这个点位大概每年会增加200点，因为通胀及利润增长。\n\n不知道几年后才有机会见到？',
        image: 'https://cdn-community.qieman.com/2CA28FFD-7B77-45F7-82A4-BD8EF5036532.jpg',
      },
      {
        postId: 63985,
        date: '2026-01-21',
        level: '外太空 8500',
        text: '500眼看就要阶段新高。\n\n未来会按照计划，在8500附近一线（外太空分界线）减持。\n\n但是减持力度会比之前预想的要弱一些，因为目前看行情还比较温柔。\n\n总之未来涨跌都有预案，等行情自己走就可以。',
      },
      {
        postId: 61657,
        date: '2026-01-12',
        level: '外太空 8500/8600',
        text: '我在5、6000点说，中证500外太空基本是8000多，8500/8600左右。\n\n有人说我画饼，骗人买指数基金。\n\n等我未来8500/8600多卖点，之后如果继续涨，又会有人说我卖飞了，赚不到大钱。\n\n甚至两波人可能是一波。\n\n其实大多数人，对于这个世界以及各种各样的事情，并没有一个理性的、客观的、不变的标准。他们看待事物，只有随波逐流，只有因时而异。牛市看涨，熊市看跌。\n\n我不想成为那样的人。\n\n所以，致敬点位我就买，外太空点位我就卖。所有点位都是几个月几年前明牌的。这就叫做——知行合一。\n\n我管你这那的呢。我赚到了钱，你得到了嘲笑我的机会。大家都有收获，多好。',
      },
    ],
  },
  {
    code: '000922.SH',
    name: '中证红利',
    levels: [{ name: '补仓', point: 4650, label: '4650–4750' }],
    quotes: [
      {
        postId: 5125601600475644,
        date: '2025-01-22',
        level: '补仓 4650–4750',
        text: '中证红利（000922）技术方面以今天点位看，4650-4750区域是不错的补仓位置。',
        url: 'https://weibo.com/7519797263/PaK0U1ZJG',
      },
    ],
  },
  {
    code: '399989.SZ',
    name: '中证医疗',
    levels: [
      { name: '压力', point: 8600, label: '8600' },
      { name: '共振支撑', point: 8100, label: '8100' },
    ],
    quotes: [
      {
        postId: 4962891897243092,
        date: '2023-10-31',
        level: '压力 8600',
        text: '医疗能突破8600一线的压力，那么下一个压力位就是C类波段减仓的位置。',
        url: 'https://weibo.com/7519797263/Nqo6xuog4',
      },
      {
        postId: 4945097747858194,
        date: '2023-09-12',
        level: '共振支撑 8100',
        text: '中证医疗目前的共振支撑底部大致是8100左右。这个点位每年会增加500-600点左右。',
        url: 'https://weibo.com/7519797263/NiVciwYh4',
      },
    ],
  },
  {
    code: '000991.SH',
    name: '全指医药',
    levels: [
      { name: '大级别支撑', point: 9600, label: '9600' },
      { name: '建仓', point: 9400, label: '9400–9500' },
    ],
    quotes: [
      {
        postId: 4991178104377627,
        date: '2024-01-17',
        level: '建仓 9400',
        text: '在我已经在几年前就预定好的医药9400点，消费13000点不买甚至清仓吗？',
        url: 'https://weibo.com/7519797263/NCfXsimOT',
      },
      {
        postId: 4856670851962864,
        date: '2023-01-11',
        level: '建仓 9400–9500',
        text: '比较值得期待的，是如果因为利空因素，医药跌到9400-9500左右，全指消费跌到12000-12500左右，将为未来若干年的超级收益奠定基础。',
        url: 'https://weibo.com/7519797263/MnMgB8eD6',
      },
      {
        postId: 4779910184829904,
        date: '2022-06-13',
        level: '大级别支撑 9600',
        text: '医药大级别支撑已经上移至9600。反正事情就是这么个事情。不跌，震荡，底部就会逐渐抬高。',
        url: 'https://weibo.com/5687069307/LxwPokgtG',
      },
    ],
  },
  {
    code: '000990.SH',
    name: '全指消费',
    levels: [
      { name: '大气层', point: 17300, label: '17300' },
      { name: '目标成本', point: 13000, label: '13000' },
    ],
    quotes: [
      {
        postId: 4991178104377627,
        date: '2024-01-17',
        level: '目标成本 13000',
        text: '在我已经在几年前就预定好的医药9400点，消费13000点不买甚至清仓吗？',
        url: 'https://weibo.com/7519797263/NCfXsimOT',
      },
      {
        postId: 4904858844664581,
        date: '2023-05-24',
        level: '大气层 17300',
        text: '在现在这个时间点，内地消费11000，全指消费17300，是正常区间与外太空的分界线。这个点位会随着时间推移不断上移。',
        url: 'https://weibo.com/7519797263/N22oQjztb',
      },
    ],
  },
  {
    code: '000942.SH',
    name: '内地消费',
    levels: [
      { name: '大气层', point: 11000, label: '11000' },
      { name: '大支撑', point: 7700, label: '7700–7800' },
    ],
    quotes: [
      {
        postId: 4904858844664581,
        date: '2023-05-24',
        level: '大气层 11000',
        text: '在现在这个时间点，内地消费11000，全指消费17300，是正常区间与外太空的分界线。这个点位会随着时间推移不断上移。',
        url: 'https://weibo.com/7519797263/N22oQjztb',
      },
      {
        postId: 4828046038667868,
        date: '2022-10-24',
        level: '大支撑 7700–7800',
        text: '另外增加一个内地消费的大支撑，在7700-7800左右。',
        url: 'https://weibo.com/5687069307/MbLBxAmUk',
      },
    ],
  },
  {
    code: '000815.SH',
    name: '中证细分食品饮料',
    levels: [
      { name: '第一笔', point: 17500, label: '17500' },
      { name: '成本区', point: 16500, label: '16500–17500' },
    ],
    quotes: [
      {
        postId: 5050248637975861,
        date: '2024-06-28',
        level: '第一笔 17500',
        text: '食品饮料，17500左右，买第一笔。',
        url: 'https://weibo.com/7519797263/Ol5cbxsSV',
      },
      {
        postId: 5047308479632201,
        date: '2024-06-20',
        level: '成本区 16500–17500',
        text: '目前食品饮料最大的问题，依然是基本面的回归和技术面的不匹配。我还是综合考虑，目标成本位暂时不变。',
        url: 'https://weibo.com/7519797263/OjQHZEpM5',
      },
      {
        postId: 5044106233386659,
        date: '2024-06-11',
        level: '成本区 16500–17500',
        text: '食品饮料指数我本人希望的成本区域在16500-17500之间。能买到就很好了。该指数最高40700点，如果能在17000左右建仓完毕，大概也就是将近60%跌幅的地方。',
        url: 'https://weibo.com/7519797263/Oivp5ed1x',
      },
    ],
  },
  {
    code: '399971.SZ',
    name: '中证传媒',
    chartEtf: { code: '512980', name: '传媒ETF' },
    chartFund: { code: '004752', name: '广发中证传媒ETF联接A' },
    gauge: { mid: 1400 },
    levels: [
      { name: '前低', point: 931, label: '931' },
      { name: '80位置', point: 950, label: '950' },
      { name: '梭哈', point: 1000, label: '1000' },
      { name: '压力', point: 1220, label: '1220' },
      { name: '减持', point: 1400, label: '1400' },
      { name: '压力线', point: 1605, label: '1605–1610' },
      { name: '上方压力', point: 1630, label: '1630' },
      { name: '再减持', point: 1700, label: '1700' },
    ],
    quotes: [
      {
        postId: 4247112000095319,
        date: '2018-06-04',
        level: '梭哈 1000',
        text: '950-1200点左右。大概率是1000点梭哈。到不了就给常规仓位。',
        url: 'https://weibo.com/7519797263/GjLB60oNp',
      },
      {
        postId: 4458115770509850,
        date: '2020-01-07',
        level: '上方压力 1630',
        text: '传媒上面的压力位在1630。',
        url: 'https://weibo.com/7519797263/IonR728Do',
      },
      {
        postId: 4475430252274069,
        date: '2020-02-24',
        level: '压力线 1605–1610',
        text: '传媒上方压力线1605-1610',
        url: 'https://weibo.com/7519797263/IvEhH9xAx',
      },
      {
        postId: 4759554443185415,
        date: '2022-04-18',
        level: '前低 931',
        text: '对霉霉感兴趣的朋友，请关注后续是否会跌破前低931。如果不跌破，那么这里就是一个极其标准的80%+双底。',
        url: 'https://weibo.com/7519797263/LoZhydmFF',
      },
      {
        postId: 4881670932793800,
        date: '2023-03-21',
        level: '压力 1220 / 减持 1400 / 再减持 1700',
        text: '传媒的压力位在1220左右。如果能突破，那么我们下一步减持位在1400左右，再下一步在1700左右。',
        url: 'https://weibo.com/7519797263/MygDjbINi',
      },
      {
        postId: 4884573396140154,
        date: '2023-03-29',
        level: '压力 1220',
        text: '注意，传媒开始回踩1220关键位。之前的压力位已经转变为支撑位，能否实质性的撑住，就能看出这波行情是否结束了。',
        url: 'https://weibo.com/7519797263/Mzu8HpLkK',
      },
      {
        postId: 4886738386555137,
        date: '2023-04-04',
        level: '突破 1403',
        text: '所以，美美1403点如果能突破，那就真的够强。我们下一个卖出目标位可能性就更大了一些。',
        url: 'https://weibo.com/7519797263/MAosCrvi1',
      },
      {
        postId: 4958126765769530,
        date: '2023-10-18',
        level: '80位置 950',
        text: '传媒继续调整新低。80位置在950点左右。',
        url: 'https://weibo.com/7519797263/Noo8QocUW',
      },
      {
        postId: 4960000675680912,
        date: '2023-10-23',
        level: '跌破 1000',
        text: '传媒即将跌破1000点。谁能想到四个月前它还在1500多，我们甚至还想着1700清仓利润。',
        url: 'https://weibo.com/7519797263/NpaThnPRC',
      },
    ],
  },
  {
    code: '000993.SH',
    name: '全指信息',
    levels: [{ name: '压力', point: 7000, label: '7000' }],
    quotes: [
      {
        postId: 4648343575724273,
        date: '2021-06-15',
        level: '压力 7000',
        text: '信息7000点左右压力位，能有效冲过去就能爽一波。',
        url: 'https://weibo.com/5687069307/KkhDvo18Z',
      },
    ],
  },
  {
    code: '399975.SZ',
    name: '证券公司',
    levels: [
      { name: '补仓', point: 600, label: '600' },
      { name: '极限底', point: 360, label: '360–400' },
    ],
    quotes: [
      {
        postId: 4187044550954405,
        date: '2017-12-20',
        level: '补仓 600',
        text: '证券公司跌破753就是700见了。然后就是我们的补仓点位，600。',
        url: 'https://weibo.com/5687069307/FAwqr40hD',
      },
      {
        postId: 4185209895457610,
        date: '2017-12-15',
        level: '极限底 360–400',
        text: '证券公司我认为360-400点应该是极限底部了。',
        url: 'https://weibo.com/5687069307/FzKHjmTLY',
      },
    ],
  },
  {
    code: '930955.CSI',
    name: '中证红利低波动100',
    levels: [
      { name: '第一支撑', point: 11200, label: '11200–11300' },
      { name: '第二支撑', point: 10500, label: '10500–10800' },
    ],
    quotes: [
      {
        postId: 58345,
        date: '2025-12-18',
        level: '支撑 11200–11300 / 10500–10800',
        text: '这几天多说了两句红利，是因为我们之前这车发的红利，所以多说了几句。\n\n有朋友问，红利哪里是低估呢。或者说，哪里可以多买点呢。\n\n未来如果大跌，计划肯定会多买。那如果计划不买，或者你想买更多，或者你已经没有跟计划了，那么我给你几个点位，你自己关注一下。\n\n我就用我们发车的红利100低波指数来说，其它的红利大差不差都是这个幅度。\n\n这个指数代码是930955。我们就用这个价格指数，不用全收益指数说。\n\n目前是11920点。\n\n在下面第一个比较大的支撑是11200-11300左右。距离目前跌幅大概是6.4%左右。\n\n再下面一个比较大的支撑大概是10500-10800左右。这个支撑更加扎实。距离目前跌幅12%左右。\n\n那你说是不是铁底，还会不会更低。经过去年恒生跌破30年铁底，你还相信有什么铁底么，我都不信了。\n\n但是，虽然不是绝对不会跌破的铁底，这两个位置应该是很不错的加仓位置。你可以看到时候计划买不买。\n\n至于说如果实质性跌破，下面还有没有支撑，从技术角度看意义不是很大了。如果碰上金融危机级别的调整，我想，极限就不好说了。25%？35%？再多我就不敢想了。\n\n注意，这两个区间是目前的点位。都会随着时间上移。每年上移4.5%左右。\n\n这么清晰的明牌不多见吧。',
      },
    ],
  },
  {
    code: 'HSI.HI',
    name: '恒生指数',
    levels: [
      { name: '最后一笔', point: 33000, label: '33000' },
      { name: '长期卖出', point: 32500, label: '32500' },
      { name: '致敬出货', point: 30000, label: '30000' },
      { name: '减持', point: 25500, label: '25500' },
      { name: '压力', point: 25000, label: '25000' },
      { name: '价值区上沿', point: 22000, label: '22000' },
      { name: '大支撑', point: 18700, label: '18700' },
    ],
    quotes: [
      {
        postId: 5082088967769874,
        date: '2024-09-24',
        level: '大支撑 18700',
        text: '今天恒生指数再次试图冲击30年趋势位。这个位置2年前是18500左右，目前已经上升到18700左右。',
        url: 'https://weibo.com/7519797263/OyrvywBiy',
      },
      {
        postId: 4862129616197252,
        date: '2023-01-26',
        level: '减持 25500',
        text: '如果恒生指数能够有效突破22500并站稳，那么上方压力位就在25500左右。在那里，致敬仓位将继续卖掉30%。',
        url: 'https://weibo.com/7519797263/Mq4h3q0bG',
      },
      {
        postId: 4858497319835645,
        date: '2023-01-16',
        level: '最后一笔 33000',
        text: '恒生的致敬仓位我大致会分为4次减持完毕。第一笔是22400附近，也就是今天卖出的。最后一笔是33000附近。我预期中的减持力度应该是20%、30%、30%、20%。',
        url: 'https://weibo.com/7519797263/MoxMvFgHr',
      },
      {
        postId: 4754884207054942,
        date: '2022-04-05',
        level: '价值区 18500–22000 / 压力 25000 / 致敬出货 30000 / 长期卖出 32500',
        text: '18500不用说，致敬底。18500-22000点，港股价值区域。如果能有效突破22000，那么25000将是下一个关键压力位。再下一个关键压力位，则是30000点——那将是致敬仓位的出货区域。再往上，则是32500左右，是150、S等长期指数卖出大部分仓位的点位。',
        url: 'https://weibo.com/5687069307/Ln1MUtBjo',
      },
    ],
  },
  {
    code: '399006.SZ',
    name: '创业板指',
    levels: [
      { name: '大压力', point: 2570, label: '2570' },
      { name: '买入', point: 1700, label: '1700–1750' },
    ],
    quotes: [
      {
        postId: 4980251461685267,
        date: '2023-12-18',
        level: '买入 1700–1750',
        text: '放个明牌，创业板指1700-1750之间会买入一笔。\n之后不出意外不会再买。',
        url: 'https://weibo.com/7519797263/NxFHQ74pJ',
      },
      {
        postId: 4858613828948825,
        date: '2023-01-16',
        level: '大压力 2570',
        text: '创业板在2570附近有个大压力。\n但毕竟只有S持仓一份，并不是大问题。所以我不准备减仓。\n跌了没卖别骂我。',
        url: 'https://weibo.com/7519797263/MoAOqBxZT',
      },
    ],
  },
  {
    code: 'HSHCI.HI',
    name: '恒生医疗',
    levels: [
      { name: '中级压力', point: 3630, label: '3630–3650' },
      { name: '中等支撑', point: 3530, label: '3530' },
      { name: '下一线', point: 2800, label: '2800–2900' },
    ],
    quotes: [
      {
        postId: 5175935990499279,
        date: '2025-06-10',
        level: '中级压力 3630–3650',
        text: '3630－3650。中级压力。',
        url: 'https://weibo.com/7519797263/PvRrp25ST',
      },
      {
        postId: 4877395365203981,
        date: '2023-03-09',
        level: '中等支撑 3530 / 下一线 2800–2900',
        text: '恒生医疗大概在3530左右有个力度中等的支撑。\n再往下就会到2800-2900一线了。\n如果再守不住，跌破前低，那下面就不知道了。可以考虑继续回归右侧买入。',
        url: 'https://weibo.com/7519797263/MwtpelPNb',
      },
    ],
  },
  {
    code: '000300.SH',
    name: '沪深300',
    levels: [{ name: '买入', point: 3450, label: '3450–3500' }],
    quotes: [
      {
        postId: 4856670851962864,
        date: '2023-01-11',
        level: '买入 3450–3500',
        text: '如果今年因为什么突发利空导致沪深300跌至3450-3500一线，那么在那个位置买入，未来1-2年的收益将可以保证。',
        url: 'https://weibo.com/7519797263/MnMgB8eD6',
      },
    ],
  },
  {
    code: '000852.SH',
    name: '中证1000',
    levels: [{ name: '共振区', point: 5400, label: '5400–5500' }],
    quotes: [
      {
        postId: 4938669517178352,
        date: '2023-08-25',
        level: '共振区 5400–5500',
        text: '中证1000共振区大致在5400-5500附近。',
        url: 'https://weibo.com/7519797263/NgdYbu7pS',
      },
    ],
  },
  {
    code: 'SPX.OTH',
    name: '标普500',
    levels: [{ name: '建仓', point: 3000, label: '3000以下' }],
    quotes: [
      {
        postId: 4878889685354817,
        date: '2023-03-13',
        level: '建仓 3000以下',
        text: '个人认为，如果标普500能因为这次银行的问题打到3000点以下，应该是是非常好的建仓区间。\n越低越好。\n等吧。',
        url: 'https://weibo.com/7519797263/Mx6hqmt21',
      },
    ],
  },
  {
    code: 'USDCNH.OTH',
    name: '美元兑人民币',
    chartBankFx: true,
    levels: [
      { name: '压力', point: 7.37, label: '7.37' },
      { name: '小支撑', point: 7.13, label: '7.13' },
      { name: '重要支撑', point: 7.08, label: '7.08' },
      { name: '下一支撑', point: 6.75, label: '6.75' },
    ],
    quotes: [
      {
        postId: 5133310829534258,
        date: '2025-02-12',
        level: '压力 7.37',
        text: '压力支撑有大小，比如说离岸美元兑人民币7.37就是一个大压力。',
        url: 'https://weibo.com/7519797263/PdYz8E0im',
      },
      {
        postId: 4979245429818512,
        date: '2023-12-15',
        level: '下一支撑 6.75',
        text: '今天已经到了7.10，距离7.08一步之遥。还是那句话，有财务计划可以自己酌情。如果还涨，那么再下一个支撑就是非常遥远的6.75附近，2023年是不可能到的。',
        url: 'https://weibo.com/7519797263/NxfxcFcf6',
      },
      {
        postId: 4969398911108674,
        date: '2023-11-18',
        level: '小支撑 7.13',
        text: '第一个小支撑在7.13左右。有财务计划的朋友可以关注一下。',
        url: 'https://weibo.com/7519797263/Nt7nJ4EpQ',
      },
      {
        postId: 4968997864868251,
        date: '2023-11-17',
        level: '重要支撑 7.08',
        text: '半年过去，美元最高位9月到了7.3682，与我判断的7.37差了0.0018。那么下一阶段来看，如果近期无法回弹至7.26上方，那么7.08左右将是一个非常重要的支撑。',
        url: 'https://weibo.com/7519797263/NsWWSkqsb',
      },
      {
        postId: 4902694781976977,
        date: '2023-05-18',
        level: '压力 7.37',
        text: '有朋友问我关于美元的问题。\n\n单从技术上说的话，目前上方已经没有均线压制。唯一的压力位是22年11月，7.37的前方高点。\n\n当然了，因为美元/R 并不是一个完全市场化的存在，所以技术有多大的用处，也不好说。',
        url: 'https://weibo.com/7519797263/N186q8iiJ',
      },
    ],
  },
];

/** 地址栏里的指数代码。对不上名单时用第一只。 */
export function resolveWatchedIndex(raw: string | null): string {
  if (raw && INDEX_WATCHES.some(item => item.code === raw)) return raw;
  return INDEX_WATCHES[0]?.code ?? '';
}
