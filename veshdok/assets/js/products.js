/**
 * Опись вещественных доказательств — данные каталога.
 * Демо-данные: цены и наличие условные.
 */

export const CATEGORIES = [
  { slug: 'men', num: '01', title: 'Мужское' },
  { slug: 'women', num: '02', title: 'Женское' },
  { slug: 'outer', num: '03', title: 'Верхняя одежда' },
  { slug: 'shoes', num: '04', title: 'Обувь и аксессуары' }
];

export const GENDERS = [
  { slug: 'm', title: 'Мужское' },
  { slug: 'w', title: 'Женское' },
  { slug: 'u', title: 'Унисекс' }
];

export const BADGES = {
  stock: 'В наличии',
  last: 'Последний экземпляр'
};

export const PRICE_MIN = 1500;
export const PRICE_MAX = 12000;

export const products = [
  {
    id: 1,
    caseNo: 'ДЕЛО № 137-24',
    title: 'Пальто прямого кроя',
    price: 11400,
    gender: 'w',
    category: 'outer',
    sizes: ['XS', 'S', 'M', 'L'],
    taken: ['XS'],
    badge: 'stock',
    silhouette: 'coat',
    admitted: '12.09',
    composition: '70% шерсть, 30% полиэстер',
    description:
      'Пальто до середины икры с объёмным силуэтом и потайной застёжкой. Держит форму и не мнётся в рукавах. Носится на осень и мягкую зиму со свитером под низ.'
  },
  {
    id: 2,
    caseNo: 'ДЕЛО № 174-24',
    title: 'Куртка-бомбер из плотного нейлона',
    price: 8900,
    gender: 'm',
    category: 'outer',
    sizes: ['M', 'L', 'XL'],
    taken: ['M'],
    badge: 'last',
    silhouette: 'bomber',
    admitted: '03.10',
    composition: '100% нейлон, подкладка вискоза',
    description:
      'Короткий бомбер с резинкой по низу и рукавам. Нейлон матовый, не продувается. Сидит свободно — рассчитан на слой снизу.'
  },
  {
    id: 3,
    caseNo: 'ДЕЛО № 211-24',
    title: 'Джинсы прямые, тёмный индиго',
    price: 5200,
    gender: 'm',
    category: 'men',
    sizes: ['30', '32', '34', '36'],
    taken: [],
    badge: 'stock',
    silhouette: 'jeans',
    admitted: '21.08',
    composition: '98% хлопок, 2% эластан',
    description:
      'Классическая прямая посадка без вытачек, средняя высота талии. Плотность 12 oz — за пару недель разнашиваются по фигуре.'
  },
  {
    id: 4,
    caseNo: 'ДЕЛО № 248-24',
    title: 'Свитер крупной вязки',
    price: 6700,
    gender: 'w',
    category: 'women',
    sizes: ['S', 'M', 'L'],
    taken: ['L'],
    badge: 'stock',
    silhouette: 'sweater',
    admitted: '28.09',
    composition: '80% шерсть ягнёнка, 20% нейлон',
    description:
      'Объёмный свитер с приспущенным плечом и высоким воротом. Пряжа мягкая, не колется на шее. Хорошо садится поверх рубашки.'
  },
  {
    id: 5,
    caseNo: 'ДЕЛО № 285-24',
    title: 'Рубашка оверсайз, оксфорд',
    price: 3900,
    gender: 'm',
    category: 'men',
    sizes: ['S', 'M', 'L', 'XL'],
    taken: [],
    badge: 'stock',
    silhouette: 'shirt',
    admitted: '15.09',
    composition: '100% хлопок',
    description:
      'Плотный оксфорд, свободный крой, удлинённая спинка. Носится навыпуск или как лёгкая куртка поверх футболки.'
  },
  {
    id: 6,
    caseNo: 'ДЕЛО № 322-24',
    title: 'Платье-миди на пуговицах',
    price: 7400,
    gender: 'w',
    category: 'women',
    sizes: ['XS', 'S', 'M'],
    taken: ['S'],
    badge: 'last',
    silhouette: 'dress',
    admitted: '07.10',
    composition: '60% вискоза, 40% лиоцелл',
    description:
      'Прямое платье с поясом и накладными карманами. Ткань с матовым блеском, лежит по фигуре и не просвечивает.'
  },
  {
    id: 7,
    caseNo: 'ДЕЛО № 359-24',
    title: 'Ботинки на протекторе, кожа',
    price: 9800,
    gender: 'u',
    category: 'shoes',
    sizes: ['40', '41', '42', '43', '44'],
    taken: ['42'],
    badge: 'stock',
    silhouette: 'boots',
    admitted: '19.09',
    composition: 'Натуральная кожа, резина',
    description:
      'Утилитарные ботинки на литой подошве. Кожа с лёгким жировым напылением, разнашиваются за неделю. Внутри остаётся место под тёплый носок.'
  },
  {
    id: 8,
    caseNo: 'ДЕЛО № 396-24',
    title: 'Футболка плотного джерси',
    price: 1900,
    gender: 'm',
    category: 'men',
    sizes: ['S', 'M', 'L', 'XL'],
    taken: [],
    badge: 'stock',
    silhouette: 'tee',
    admitted: '02.10',
    composition: '100% хлопок, 220 г/м²',
    description:
      'Базовая футболка с прямым корпусом и укреплённой горловиной. Плотность держит форму после стирок, горловина не вытягивается.'
  },
  {
    id: 9,
    caseNo: 'ДЕЛО № 433-24',
    title: 'Брюки-карго, рип-стоп',
    price: 5600,
    gender: 'm',
    category: 'men',
    sizes: ['M', 'L', 'XL'],
    taken: [],
    badge: 'stock',
    silhouette: 'cargo',
    admitted: '25.09',
    composition: '65% хлопок, 35% полиамид',
    description:
      'Свободные брюки с боковыми карманами и кулиской по низу. Рип-стоп не тянется и держит форму даже после долгой носки.'
  },
  {
    id: 10,
    caseNo: 'ДЕЛО № 470-24',
    title: 'Юбка-миди плиссе',
    price: 4300,
    gender: 'w',
    category: 'women',
    sizes: ['XS', 'S', 'M', 'L'],
    taken: ['XS', 'M'],
    badge: 'stock',
    silhouette: 'skirt',
    admitted: '11.10',
    composition: '100% полиэстер',
    description:
      'Плиссированная юбка на резинке с подкладкой. Складка держится без утюга, длина до середины голени.'
  },
  {
    id: 11,
    caseNo: 'ДЕЛО № 507-24',
    title: 'Ремень кожаный с латунной пряжкой',
    price: 2400,
    gender: 'u',
    category: 'shoes',
    sizes: ['85', '90', '95', '100'],
    taken: ['90'],
    badge: 'stock',
    silhouette: 'belt',
    admitted: '30.09',
    composition: 'Натуральная кожа, латунь',
    description:
      'Ремень толщиной 3,5 мм из цельного куска кожи. Пряжка без покрытия — со временем темнеет и выглядит только лучше.'
  },
  {
    id: 12,
    caseNo: 'ДЕЛО № 544-24',
    title: 'Тренч из хлопка-габардина',
    price: 12000,
    gender: 'w',
    category: 'outer',
    sizes: ['S', 'M', 'L'],
    taken: ['M'],
    badge: 'last',
    silhouette: 'trench',
    admitted: '05.10',
    composition: '100% хлопок',
    description:
      'Классический двубортный тренч с погонами и поясом. Габардин с водоотталкивающей пропиткой — рабочая вещь на межсезонье.'
  },
  {
    id: 13,
    caseNo: 'ДЕЛО № 581-24',
    title: 'Жилет стёганый утеплённый',
    price: 6400,
    gender: 'u',
    category: 'outer',
    sizes: ['S', 'M', 'L', 'XL'],
    taken: ['S'],
    badge: 'stock',
    silhouette: 'vest',
    admitted: '08.10',
    composition: 'Верх полиэстер, утеплитель синтепух',
    description:
      'Жилет прямого кроя со стёжкой и высоким воротом. Надевается поверх свитера или под пальто, когда одного слоя мало.'
  },
  {
    id: 14,
    caseNo: 'ДЕЛО № 618-24',
    title: 'Шапка-бини, шерсть мериноса',
    price: 1690,
    gender: 'u',
    category: 'shoes',
    sizes: ['ONE SIZE'],
    taken: [],
    badge: 'stock',
    silhouette: 'beanie',
    admitted: '14.10',
    composition: '100% шерсть мериноса',
    description:
      'Тонкая шапка двойной вязки с отворотом. Мериносовая пряжа не колется и не растягивается за сезон.'
  }
];

/** Все размеры, встречающиеся в описи, в осмысленном порядке. */
export const ALL_SIZES = (() => {
  const order = ['XS', 'S', 'M', 'L', 'XL', 'ONE SIZE'];
  const found = new Set();
  products.forEach((p) => p.sizes.forEach((s) => found.add(s)));
  const letters = order.filter((s) => found.has(s));
  const numbers = [...found]
    .filter((s) => !order.includes(s))
    .sort((a, b) => Number(a) - Number(b));
  return [...letters, ...numbers];
})();

export const categoryTitle = (slug) =>
  (CATEGORIES.find((c) => c.slug === slug) || {}).title || slug;

export const genderTitle = (slug) =>
  (GENDERS.find((g) => g.slug === slug) || {}).title || slug;

export const countByCategory = (slug) =>
  products.filter((p) => p.category === slug).length;
