const fs = require('fs');
const fsp = require('fs').promises;


module.exports = function (app) {

  let unsubscribes = []

  
  let _localSubscription = function(options) {
    const subscribeArray = []
    options.paths.forEach(path => {
      const subscribe = {}
      subscribe.path = path
      subscribe.policy = "instant"
      subscribeArray.push(subscribe)
    })
    return (localSubscription = {
      "context" : "vessels.self",
      "subscribe" : subscribeArray
    })
  }

  let _loadFuelUsage = function(options) {
    const usage = {}
    if (options.savedUsage) {
      options.paths.forEach(path => {

        if (!options.savedUsage[path]) {
          options.savedUsage[path] = 0
        }
      })      
    }
    else {
      options.savedUsage = {}
      options.paths.forEach(path => {
        options.savedUsage[path] = 0
      })
    }
    app.debug(options)
  }


  let _start = function(options) {
    app.debug(`${plugin.name} Started...`)
    _loadFuelUsage(options)
    

    //app.savePluginOptions(options, () => {app.debug('Plugin options saved')});
    app.subscriptionmanager.subscribe(
      _localSubscription(options),
      unsubscribes,
      subscriptionError => {
        app.error('Error:' + subscriptionError);
      },
      delta => {
        delta.updates.forEach(u => {
          app.debug(u.values);
        });
      }
    );

  }

  let _stop = function(options) {
    app.debug(`${plugin.name} Stopped...`)
    unsubscribes.forEach(f => f());
    unsubscribes = [];
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
          default: ['propulsion.port.fuel.rate','propulsion.port.fuel.rate'],
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
    },

        
    start: _start,
    stop: _stop
  }


return plugin;

}
