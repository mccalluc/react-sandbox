import Ajv from 'ajv';
import AbstractLoader from './AbstractLoader';

import cellsSchema from '../schemas/cells.schema.json';
import factorsSchema from '../schemas/factors.schema.json';
import moleculesSchema from '../schemas/molecules.schema.json';
import neighborhoodsSchema from '../schemas/neighborhoods.schema.json';
import rasterSchema from '../schemas/raster.schema.json';
import cellSetsSchema from '../schemas/cell-sets.schema.json';

const typeToSchema = {
  CELLS: cellsSchema,
  FACTORS: factorsSchema,
  MOLECULES: moleculesSchema,
  NEIGHBORHOODS: neighborhoodsSchema,
  RASTER: rasterSchema,
  'CELL-SETS': cellSetsSchema,
};

export default class JsonLoader extends AbstractLoader {
  constructor(params) {
    super(params);

    const { type } = params;
    this.schema = typeToSchema[type];
  }

  load() {
    const {
      url, requestInit, type, name,
    } = this;
    if (this.data) {
      return this.data;
    }
    this.data = fetch(url, requestInit)
      .then((response) => {
        if (response.ok) {
          return response.json();
        }
        return Promise.reject(response.headers);
      })
      .catch((reason) => {
        console.warn(`"${name}" (${type}) from ${url}: fetch failed`, reason);
        return Promise.reject(new Error(`Error while fetching ${name}.`));
      })
      .then((data) => {
        const [valid, reason] = this.validate(data);
        if (valid) {
          return Promise.resolve(data);
        }
        return Promise.reject(reason);
      })
      .catch((reason) => {
        console.warn(`"${name}" (${type}) from ${url}: validation failed`, JSON.stringify(reason, null, 2));
        return Promise.reject(new Error(`Error while validating ${name}.`));
      });
    return this.data;
  }

  validate(data) {
    const { schema, type } = this;
    if (!schema) {
      throw Error(`No schema for ${type}`);
    }
    const validate = new Ajv().compile(schema);
    const valid = validate(data);
    let failureReason;
    if (!valid) {
      failureReason = validate.errors;
    }
    return [valid, failureReason];
  }
}