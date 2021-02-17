const fs = require('fs');
const fsp = require('fs').promises;

module.exports = function (app) {


  var plugin = {};


  plugin.id = 'fuel-usage-calculator';
  plugin.name = 'Fuel Usage Calculator';
  plugin.description = 'A Signalk plugin to calculate your fuel usage based on propulsion.*.fuel.rate';

  plugin.onStop=[]

  var timerIdDelta;
  var timerIdPath;




  plugin.start = function (options, restartPlugin) {
    var persistedData = require('path').join(app.getDataDirPath(), 'persistedData.json')    
    plugin.onStop=[]
    plugin.record={}
    // Here we put our plugin logic
    app.debug(`${plugin.id} started`);

    timerIdDelta = setInterval(() => {
      try {
        for (const [key, value] of Object.entries(plugin.record)) {
          

          timeTrigger=Date.now()-plugin.record[key].fuelUsedTime
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
      catch (error) {
        app.debug(error)
      }
    }  , 1000)

    timerIdDelta = setInterval(() => {
      try {
        fs.writeFile(persistedData, JSON.stringify(plugin.record), (error) => {
          if (error) throw error;
          app.debug(`Fuel usage saved to Disk ${JSON.stringify(plugin.record)}`)
        });         
      }
      catch (error) {
        app.debug(error)
      }
    }
      , options.saveFreq)

    loadFile(options, plugin.onStop, plugin.record,persistedData)
    
  };

  plugin.stop = function () {
    plugin.onStop.forEach(f => f());
    clearInterval(timerIdPath)
    clearInterval(timerIdDelta)
    // Here we put logic we need when the plugin stops
    app.debug('Plugin stopped');
  };
  

  plugin.schema = {
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
      },      
    }
  };



  function startStream(options, onStop, record) {
    const values={}
    options.paths.forEach(path => {
      plugin.onStop.push(
        app.streambundle
          .getSelfBus(path)
          .forEach(pos => {
            fuelCalc(options,record,path,pos.value,Date.parse(pos.timestamp))
          }
          )
      )    
    }
    )
  }

  function fuelCalc(options,record,path,value,timestamp) {
    if (record[path] == undefined) {
      app.debug(`${record[path]} is undefined so creating the first timestamp'`)
      record[path]={'firstTime':timestamp}

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
        }      
      record[path].firstTime=timestamp        
      }
    }
    plugin.record=record
  }

  async function loadFile(options, onStop, record, persistedData) {
      const data = await fsp.readFile(persistedData)
        .then((data) => {
          app.debug(`loaded saved paramaters: ${(data)}`)        
          record=JSON.parse(data);
          startStream(options, onStop, record)       
          })   

        .catch((err) => {
          app.debug(`Theres is currently no saved fuel usage data saved on file - resetting usage to 0`)
          plugin.record={}
          startStream(options, onStop, record) 
        })




  }
    


  return plugin;

};