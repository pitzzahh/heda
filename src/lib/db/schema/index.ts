export const project_schema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    highest_unit_form: {
      type: 'any'
    },
    tree: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'number'
          },
          name: {
            type: 'string'
          },
          loads: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string'
                },
                load_description: {
                  type: 'string'
                },
                quantity: {
                  type: 'number'
                },
                varies: {
                  type: 'number'
                },
                is_panel: {
                  type: 'number'
                },
                continuous: {
                  type: 'number'
                },
                special: {
                  type: 'string'
                },
                loads: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: {
                        type: 'string'
                      },
                      load_description: {
                        type: 'string'
                      },
                      quantity: {
                        type: 'number'
                      },
                      varies: {
                        type: 'number'
                      },
                      is_panel: {
                        type: 'number'
                      },
                      continuous: {
                        type: 'number'
                      },
                      special: {
                        type: 'string'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  required: ['id', 'highest_unit_form', 'tree']
};