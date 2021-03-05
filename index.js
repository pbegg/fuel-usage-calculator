const fs = require('fs');
const fsp = require('fs').promises;


module.exports = function (app) {

  let unsubscribes = []

  let fuelUsage = {}

  let record = {}

  let updateDeltaInterval

  let saveFuelUsageInterval


  let updateDelta = function(record) {
      for (const [key, value] of Object.entries(record)) {
        

        timeTrigger=Date.now()-record[key].fuelUsedTime
        if (timeTrigger<=5000) {
          usedPath=key.split('.')
          usedPath[3]='used'
          usedPath=usedPath.join('.')
          app.handleMessage(plugin.id, {
            updates: [
              {
                values: [
                  {
                    path: usedPath,
                    value: value.fuelUsed
                  }
                ]
              }
            ]
          })             
        }
      }    

  }

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

  //needs to receive an array for pathArray
  let _convertRateToUsed = function (pathArray) {
    const usedArray = []
    pathArray.forEach(path => {
      splitRate = path.split('.')
      splitRate[3] = 'used'
      splitRate=splitRate.join('.')
      usedArray.push(splitRate)
    })
    return usedArray
  }

  let _loadFuelUsage = function(options) {
    const usage = {}
    const usedPath = _convertRateToUsed(options.paths)
    if (options.savedUsage) {
      usedPath.forEach(path => {
        if (options.savedUsage[path] === undefined) {
          options.savedUsage[path] = 0
        }
        else {
          record[path]={'fuelUsed':options.savedUsage[path]}
        }
      })      
    }
    else {
      options.savedUsage = {}
      usedPath.forEach(path => {
        options.savedUsage[path] = 0
      })
    }
    _saveFuelUsage(options)
    return options
  }


  let _saveFuelUsage = function(options) {
    app.savePluginOptions(options, () => {
      app.debug(`Fuel Used: ${JSON.stringify(options.savedUsage)}`)
    });
  }

  let fuelCalc = function (options,record,path,value,timestamp) {
    app.debug(`record is ${JSON.stringify(record)}`)
    if (record[path]['firstTime'] == undefined) {
      app.debug(`${record[path]} is undefined so creating the first timestamp'`)
      record[path]['firstTime']={'firstTime':timestamp}

    }
    if (record[path].firstTime) {
      record[path].secondTime=timestamp
      var elapsedTime=record[path].secondTime-record[path].firstTime
      //app.debug(`elapsedTime is ${elapsedTime}`)
      if (elapsedTime!= 0) {
        if (elapsedTime <= options.timeout) {

            
            const ratio=1000/elapsedTime
            const instantFuelUsage=value/ratio
            //app.debug(`instantFuelUsage: ${instantFuelUsage}`)
            if (record[path].fuelUsed == undefined) {
              record[path].fuelUsed=instantFuelUsage
              record[path].fuelUsedTime=Date.now()

            }
            if (record[path].fuelUsed != undefined) {
              record[path].fuelUsed+=instantFuelUsage
              record[path].fuelUsedTime=Date.now()
            }
            options.savedUsage[path]=record[path].fuelUsed
            app.debug(JSON.stringify(options))
            //_saveFuelUsage(options)
        }      
      record[path].firstTime=timestamp        
      }
    }
  }
  


  let _start = function(options) {
    app.debug(`${plugin.name} Started...`)
    fuelUsage = _loadFuelUsage(options).savedUsage
    app.debug(fuelUsage)

    updateDeltaInterval = setInterval(function() {
        updateDelta(record);
    }, 1000);    

    saveFuelUsageInterval = setInterval(function() {
        _saveFuelUsage(options);
    }, options.saveFreq);  

    app.subscriptionmanager.subscribe(
      _localSubscription(options),
      unsubscribes,
      subscriptionError => {
        app.error('Error:' + subscriptionError);
      },
      delta => {
        delta.updates.forEach(u => {
          fuelCalc(options,record,_convertRateToUsed([u.values[0].path]),u.values[0].value,Date.parse(u.timestamp))
          app.debug(u);
        });
      }
    );

  }

  let _stop = function(options) {
    app.debug(`${plugin.name} Stopped...`)
    unsubscribes.forEach(f => f());
    unsubscribes = [];

    if (updateDeltaInterval) {
        clearInterval(updateDeltaInterval);
    }
    // clean up the state
    updateDeltaInterval = undefined;

    if (saveFuelUsageInterval) {
        clearInterval(saveFuelUsageInterval);
    }
    // clean up the state
    saveFuelUsageInterval = undefined;
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
          default: ['propulsion.port.fuel.rate','propulsion.starboard.fuel.rate'],
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
