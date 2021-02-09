const fs = require('fs');
const fsp = require('fs').promises;

module.exports = function (app) {

  let _start = function(options) {
    debug(`${plugin.name} Started...`)

  }

  let _stop = function(options) {
    debug(`${plugin.name} Stopped...`)
  }

  const plugin = {
    id: 'fuel-usage-calculator',
    name: 'Fuel Usage Calculator',
    description: 'A Signalk plugin to calculate your fuel usage based on propulsion.*.fuel.rate',

    schema: {
      type: 'object',
      required: ['paths', 'saveFreq'],
      properties: {
        paths: {
          type: 'array',
          title: 'Paths to use for fuel calculations',
          default: ['propulsion.port.fuel.rate'],
          items: {
            type: 'string'
          }
        },
        saveFreq: {
          type: 'number',
          title: 'How often to save the fuel used to disk',
          default: 15000
        },
        timeout: {
          type: 'number',
          title: 'How long until timeout',
          default: 10000
        }      
      }
    };

        
    start: _start,
    stop: _stop
  }


return plugin;

}
