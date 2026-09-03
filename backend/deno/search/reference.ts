/**
 * Справочники кодов: аэропорты и авиакомпании.
 *
 * NDC-ответ содержит только коды (DME, IKT, S7). Названия для карточки рейса
 * подставляет бэкенд — это его зона ответственности, а не фронта: справочник
 * один и тот же для любого поставщика, и обновлять его в одном месте дешевле,
 * чем в трёх компонентах.
 *
 * Список сознательно ограничен маршрутной сетью, с которой работает сайт.
 * Когда он перестанет помещаться в файл, его место — в базе, а здесь останется
 * функция доступа с той же сигнатурой; вызывающий код менять не придётся.
 */

export interface AirportInfo {
  city: string;
  airport: string;
  country?: string;
}

const AIRPORTS: Record<string, AirportInfo> = {
  MOW: { city: "Москва", airport: "Все аэропорты", country: "RU" },
  SVO: { city: "Москва", airport: "Шереметьево", country: "RU" },
  DME: { city: "Москва", airport: "Домодедово", country: "RU" },
  VKO: { city: "Москва", airport: "Внуково", country: "RU" },
  ZIA: { city: "Москва", airport: "Жуковский", country: "RU" },
  LED: { city: "Санкт-Петербург", airport: "Пулково", country: "RU" },
  AER: { city: "Сочи", airport: "Сочи", country: "RU" },
  KZN: { city: "Казань", airport: "Казань", country: "RU" },
  SVX: { city: "Екатеринбург", airport: "Кольцово", country: "RU" },
  OVB: { city: "Новосибирск", airport: "Толмачёво", country: "RU" },
  KJA: { city: "Красноярск", airport: "Емельяново", country: "RU" },
  IKT: { city: "Иркутск", airport: "Иркутск", country: "RU" },
  VVO: { city: "Владивосток", airport: "Кневичи", country: "RU" },
  KHV: { city: "Хабаровск", airport: "Новый", country: "RU" },
  UUS: { city: "Южно-Сахалинск", airport: "Хомутово", country: "RU" },
  PKC: { city: "Петропавловск-Камчатский", airport: "Елизово", country: "RU" },
  KGD: { city: "Калининград", airport: "Храброво", country: "RU" },
  MRV: { city: "Минеральные Воды", airport: "Минеральные Воды", country: "RU" },
  UFA: { city: "Уфа", airport: "Уфа", country: "RU" },
  GOJ: { city: "Нижний Новгород", airport: "Стригино", country: "RU" },
  ROV: { city: "Ростов-на-Дону", airport: "Платов", country: "RU" },
  KRR: { city: "Краснодар", airport: "Пашковский", country: "RU" },
  SIP: { city: "Симферополь", airport: "Симферополь", country: "RU" },
  TJM: { city: "Тюмень", airport: "Рощино", country: "RU" },
  OMS: { city: "Омск", airport: "Центральный", country: "RU" },
  PEE: { city: "Пермь", airport: "Большое Савино", country: "RU" },
  CEK: { city: "Челябинск", airport: "Баландино", country: "RU" },
  KUF: { city: "Самара", airport: "Курумоч", country: "RU" },
  VOG: { city: "Волгоград", airport: "Гумрак", country: "RU" },
  MMK: { city: "Мурманск", airport: "Мурмаши", country: "RU" },
  ARH: { city: "Архангельск", airport: "Талаги", country: "RU" },
  BAX: { city: "Барнаул", airport: "Михайловка", country: "RU" },
  ABA: { city: "Абакан", airport: "Абакан", country: "RU" },
  BQS: { city: "Благовещенск", airport: "Игнатьево", country: "RU" },
  YKS: { city: "Якутск", airport: "Якутск", country: "RU" },
  GDX: { city: "Магадан", airport: "Сокол", country: "RU" },
  NOZ: { city: "Новокузнецк", airport: "Спиченково", country: "RU" },
  TOF: { city: "Томск", airport: "Богашёво", country: "RU" },
  KEJ: { city: "Кемерово", airport: "Кемерово", country: "RU" },
  HTA: { city: "Чита", airport: "Кадала", country: "RU" },
  ULY: { city: "Ульяновск", airport: "Баратаевка", country: "RU" },
  TSE: { city: "Астана", airport: "Нурсултан Назарбаев", country: "KZ" },
  ALA: { city: "Алматы", airport: "Алматы", country: "KZ" },
  TAS: { city: "Ташкент", airport: "Ислам Каримов", country: "UZ" },
  SKD: { city: "Самарканд", airport: "Самарканд", country: "UZ" },
  FRU: { city: "Бишкек", airport: "Манас", country: "KG" },
  EVN: { city: "Ереван", airport: "Звартноц", country: "AM" },
  GYD: { city: "Баку", airport: "Гейдар Алиев", country: "AZ" },
  TBS: { city: "Тбилиси", airport: "Тбилиси", country: "GE" },
  MSQ: { city: "Минск", airport: "Минск", country: "BY" },
  IST: { city: "Стамбул", airport: "Стамбул", country: "TR" },
  AYT: { city: "Анталья", airport: "Анталья", country: "TR" },
  DXB: { city: "Дубай", airport: "Дубай", country: "AE" },
  AUH: { city: "Абу-Даби", airport: "Зайд", country: "AE" },
  HKT: { city: "Пхукет", airport: "Пхукет", country: "TH" },
  BKK: { city: "Бангкок", airport: "Суварнабхуми", country: "TH" },
  PEK: { city: "Пекин", airport: "Столичный", country: "CN" },
  PVG: { city: "Шанхай", airport: "Пудун", country: "CN" },
  DEL: { city: "Дели", airport: "Индиры Ганди", country: "IN" },
  CAI: { city: "Каир", airport: "Каир", country: "EG" },
  HRG: { city: "Хургада", airport: "Хургада", country: "EG" },
  SSH: { city: "Шарм-эль-Шейх", airport: "Шарм-эль-Шейх", country: "EG" },
};

const AIRLINES: Record<string, string> = {
  S7: "S7 Airlines",
  SU: "Аэрофлот",
  U6: "Уральские авиалинии",
  DP: "Победа",
  UT: "ЮТэйр",
  N4: "Северный ветер",
  FV: "Россия",
  GH: "Азимут",
  WZ: "Red Wings",
  IO: "IrAero",
  ZF: "Азур Эйр",
  KC: "Air Astana",
  HY: "Uzbekistan Airways",
  TK: "Turkish Airlines",
  EK: "Emirates",
};

/** Название аэропорта по коду. Неизвестный код возвращается как есть — выдача не должна пропадать из-за пробела в справочнике. */
export const describeAirport = (code: string): AirportInfo => AIRPORTS[code] ?? { city: code, airport: code };

/** Название авиакомпании по коду IATA. Неизвестный код возвращается как есть. */
export const describeAirline = (code: string): string => AIRLINES[code] ?? code;
