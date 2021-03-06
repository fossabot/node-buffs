import dotenv from 'dotenv';

export type Options = {
  [key: string]: string | number | boolean;
};

export type Func = () => any;

export type FOptionsLoader = Options | Func;

export interface IConfigLoaderOpts {
  /**
   * 从 process.env 加载一个 ENV 属性，其值用于识别 .env 的后缀
   * e.g ENV=test will load .env.test
   */
  dotenvBy?: string;
  /**
   * 配置加载器，可以是一个方法或配置对象
   */
  optionsLoader?: FOptionsLoader;
  /**
   * 设置必填字段
   */
  requiredVariables?: string[];
  /**
   * 覆盖配置，优先级最高
   */
  overwriteOptions?: Options;
  /**
   * 配置加载路径
   */
  path?: string;
  /**
   * 自定义后缀
   */
  suffix?: string;
}

const _ = {
  get: require('lodash/get'),
  mapValues: require('lodash/mapValues'),
  zipObject: require('lodash/zipObject'),
  assign: require('lodash/assign'),
  filter: require('lodash/filter'),
  isFunction: require('lodash/isFunction'),
  isObjectLike: require('lodash/isObjectLike'),
  isNil: require('lodash/isNil'),
  isEmpty: require('lodash/isEmpty'),
};

export function createConfigLoader(opts: IConfigLoaderOpts): ConfigLoader {
  return new ConfigLoader(opts);
}

/**
 * 读取配置文件
 * @param {string} by 从 process.env 中读取指定的后缀，default: ENV
 * @param path 访问路径，默认为 .
 * @param suffix .env 文件后缀
 * @returns {Options}
 */
export function loadDotEnv(by: string = 'ENV', path: string = '.', suffix: string = ''): Options {
  const _suffix = process.env[by] || suffix ? `.${process.env[by] || suffix}` : '';
  const _path = `${path}/.env${_suffix}`;
  const dotenvResult = dotenv.config({ path: _path });
  if (dotenvResult.error) {
    console.warn(dotenvResult.error.message);
    return {};
  }
  return dotenvResult.parsed || {}; // load .env into process.env}
}

/**
 * 配置读取器，加载优先级：
 * overwrite options -> process.env -> options(.env) -> optionsLoader(user config) -> default
 */
export class ConfigLoader {
  /**
   * 从 process.env 读取要加载的 .env 后缀，default: ENV
   */
  private readonly dotenvBy: string;
  /**
   * 配置加载器，可以是一个方法或配置对象
   */
  private readonly optionsLoader: FOptionsLoader;
  /**
   * 设置必填字段
   */
  private requiredVariables: string[];
  /**
   * 覆盖配置，优先级最高
   */
  private overwriteOptions: Options;
  /**
   * 加载自 .env 的配置
   * @type {{}}
   */
  private options: Options = {};

  constructor(opts: IConfigLoaderOpts = {}) {
    this.dotenvBy = opts.dotenvBy || 'ENV';
    this.optionsLoader = opts.optionsLoader || {};
    this.overwriteOptions = opts.overwriteOptions || {};
    this.requiredVariables = opts.requiredVariables || [];
    this.options = loadDotEnv(this.dotenvBy, opts.path, opts.suffix);
    this.validate();
  }

  /**
   * load config from env first, then options loader, and default at last.
   * @param {string} key            - property key
   * @param {any=null} defaultValue - default value
   * @returns {any}                 - property value
   */
  public loadConfig(key: string, defaultValue: any = null): any {
    const value =
      this.overwriteOptions[key] ||
      process.env[key] ||
      this.options[key] ||
      this.loadConfigFromOptions(key) ||
      defaultValue;
    if (/^\d+$/.test(value)) {
      return +value;
    }
    if (/^(true|false)$/.test(value)) {
      return value === 'true';
    }
    return value;
  }

  public loadConfigs(): Options {
    const configs = _.assign(_.zipObject(this.requiredVariables), this.options);
    return _.mapValues(configs, (value: string | number | boolean, key: string) =>
      this.loadConfig(key)
    );
  }

  /**
   * 设置必设参数，未找到值时报错
   * @param {string[]} requires
   */
  public setRequiredVariables(requires: string[]): void {
    this.requiredVariables = requires;
  }

  public setOverwriteOptions(options: Options): void {
    this.overwriteOptions = { ...this.overwriteOptions, ...options };
  }

  public validate(): void {
    const notExists = _.filter(this.requiredVariables, (key: string) =>
      _.isNil(this.loadConfig(key))
    );
    if (!_.isEmpty(notExists)) {
      throw new Error(`[ConfigLoader] "${notExists}" is required.`);
    }
  }

  private loadConfigFromOptions(key: string): any {
    return _.isObjectLike(this.optionsLoader)
      ? _.get(this.optionsLoader, key)
      : _.isFunction(this.optionsLoader)
        ? _.get((this.optionsLoader as Func)(), key)
        : null;
  }
}
