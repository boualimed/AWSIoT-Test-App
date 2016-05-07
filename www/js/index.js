angular.module('IoTApp', ['ngRoute', 'ngMaterial', 'ngStorage'])

  .config(['$routeProvider', '$locationProvider',
    function ($routeProvider, $locationProvider) {
      $routeProvider
        .when('/region', {
          templateUrl: 'view/region-list.html',
          controller: 'RegionListCtrl'
        })
        .when('/region/:id', {
          templateUrl: 'view/region-detail.html',
          controller: 'RegionDetailCtrl'
        })
        .otherwise('/region');

      $locationProvider.html5Mode(false);
    }
  ])

  .constant('Settings', {
    regions: [
      {
        id: 'us-east-1',
        name: 'US East (N. Virginia)'
      },
      {
        id: 'us-west-2',
        name: 'US West (Oregon)'
      },
      {
        id: 'eu-west-1',
        name: 'EU (Ireland)'
      },
      {
        id: 'eu-central-1',
        name: 'EU (Frankfurt)'
      },
      {
        id: 'ap-northeast-1',
        name: 'Asia Pacific (Tokyo)'
      },
      {
        id: 'ap-southeast-1',
        name: 'Asia Pacific (Singapore)'
      }
    ],
    msgCount: 10,
    msgInterval: 3000, // milliseconds
    parallel: true,  // test all regions simultaneously
    accessKeyId: 'AWS_IAM_IoT_AccessKey',
    secretKey: 'AWS_IAM_IoT_SecretKey'
  })

  .factory('Device', ['$localStorage', function ($localStorage) {
    var geoReady = false, geoError = { code: 4, message: 'Operation in progress' };
    document.addEventListener('deviceready', function () {
      if (!$localStorage.uuid) {
        $localStorage.uuid = device.uuid;
      }

      navigator.geolocation.getCurrentPosition(
        function (position) {
          $localStorage.position = {
            accuracy: position.coords.accuracy,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          geoReady = true;
        },
        function (positionError) {
          geoError = positionError;
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });

    var isReady = function (successCallback, errorCallback) {
      // if (!geoReady) {
      //   errorCallback(geoError);
      //   return;
      // }
      if (navigator.connection.type === Connection.NONE) {
        errorCallback({
          code: 5,
          message: 'No network connection'
        });
        return;
      }

      $localStorage.networkType = navigator.connection.type;
      successCallback();
    };

    return { isReady: isReady };
  }])

  .factory('AWSIoT', ['Settings', function (Settings) {
    var timer = {
      _timers: {},
      time: function (label) {
        this._timers[label] = Date.now();
      },
      timeEnd: function (label) {
        var time = this._timers[label];
        if (!time) {
          throw new Error('No such label: ' + label);
        }
        return Date.now() - time;
      }
    };

    var avg = function (array) {
      if (!array.length) return 0;
      var sum = array.reduce(function (prev, curr) {
        return prev + curr;
      });
      return decimalRound(sum / array.length, -2);
    };

    var decimalRound = function (value, exp) {
      value = value.toString().split('e');
      value = Math.round(+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
      value = value.toString().split('e');
      return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
    };

    var test = function (regionId, connCallback, pingCallback) {
      var intervalID,
          topic = regionId + Math.floor(Math.random() * Math.pow(10, 10)),
          count = 0,
          msgCount = Settings.msgCount,
          msgInterval = Settings.msgInterval,
          msgSpendTime = [];

      var publish = function () {
        count += 1;
        timer.time(regionId + ':' + count);
        device.publish(topic, JSON.stringify({ count: count }));
      };

      var device = window.AWSIoT.device({
        region: regionId,
        protocol: 'wss',
        accessKeyId: Settings.accessKeyId,
        secretKey: Settings.secretKey
      });

      timer.time(regionId);

      var connected = false;
      device.on('connect', function () {
        connected = true;
        console.log('Connected: ' + regionId);
        connCallback(timer.timeEnd(regionId), regionId);

        device.subscribe(topic, {qos: 0}, function () {
          publish();
          intervalID = setInterval(publish, msgInterval);
        });
      });

      device.on('close', function () {
        if (!connected) return;
        console.log('Connection closed: ' + regionId);
        pingCallback(avg(msgSpendTime), regionId);
      });

      device.on('message', function (topic, payload) {
        console.log('Message recevied: ' + regionId);
        msgSpendTime.push(timer.timeEnd(regionId + ':' + JSON.parse(payload).count));
        if (count === msgCount) {
          clearInterval(intervalID);
          device.end();
        }
      });

      device.on('reconnect', function () {
        console.log('Try reconnect ' + regionId);
      });
      device.on('offline', function () {
        console.log('Offline from: ' + regionId);
      });
      device.on('error', function (err) {
        console.log('Error ' + regionId + ':\n', err);
      });
    };

    return { test: test };
  }])

  .controller('RegionListCtrl', ['$scope', '$interval', '$localStorage',
    'Settings', 'AWSIoT', 'Device', '$mdDialog',
    function ($scope, $interval, $localStorage, Settings, AWSIoT, Device, $mdDialog) {
      $scope.inTest = false;
      $scope.spendTime = 0;
      $scope.latestTests = {};
      $scope.regions = Settings.regions;

      $scope.regions.forEach(function (region) {
        var tests = $localStorage[region.id] || [];

        var latestTest = {
          conn: 0,
          ping: 0,
          state: 'done' // 'conn', 'ping', 'done'
        };

        if (tests.length) {
          latestTest.conn = tests[0].connTime;
          latestTest.ping = tests[0].pingTime;
        }

        $scope.latestTests[region.id] = latestTest;
      });

      var timer, timestamp;
      $scope.start = function () {
        Device.isReady(start, function (err) {
          var title = 'Error',
              content = '',
              ok = 'OK';

          switch (err.code) {
            case 1: // PERMISSION_DENIED
            case 2: // POSITION_UNAVAILABLE
              content = 'Geolocation is required. Please enable it and try again.';
              break;
            case 3: // TIMEOUT
              content = 'Get geolocation info failed. Please try again later.';
              break;
            case 4: // OPERATION_IN_PROGRESS
              content = 'Still getting geolocation info. Please wait a minute.';
              break;
            case 5: // NO_NETWORK_CONNECTION
              content = 'No network connection. Please enable it and try again.';
              break;
          }

          var alert = $mdDialog.alert()
            .title(title)
            .textContent(content)
            .ok(ok);
          $mdDialog.show(alert);
        });
      };

      var start = function () {;
        timestamp = Date.now();
        $scope.inTest = true;
        timer = $interval(function () {
          $scope.spendTime += 1;
        }, 1000);

        var fn = Settings.parallel ? async.each : async.eachSeries;
        fn($scope.regions, function (region, callback) {
          var latestTest = $scope.latestTests[region.id];
          latestTest.conn = 0;
          latestTest.ping = 0;
          latestTest.state = 'conn';

          AWSIoT.test(region.id, connCallback, function () {
            pingCallback.apply(null, Array.prototype.slice.call(arguments));
            callback();
          });
        }, allDoneCallback);
      };

      var connCallback = function (milliseconds, regionId) {
        var latestTest = $scope.latestTests[regionId];
        latestTest.conn = milliseconds;
        latestTest.state = 'ping';
        $scope.$apply();
      };

      var pingCallback = function (milliseconds, regionId) {
        var latestTest = $scope.latestTests[regionId];
        latestTest.ping = milliseconds;
        latestTest.state = 'done';
        $scope.$apply();
      };

      var allDoneCallback = function () {
        $scope.inTest = false;
        $interval.cancel(timer);

        Object.keys($scope.latestTests).forEach(function (regionId) {
          var latestTest = {
            timestamp: timestamp,
            geolocation: $localStorage.position,
            networkType: $localStorage.networkType,
            connTime: $scope.latestTests[regionId].conn,
            pingTime: $scope.latestTests[regionId].ping
          }
          if ($localStorage[regionId]) {
            $localStorage[regionId].unshift(latestTest);
          }
          else {
            $localStorage[regionId] = [latestTest];
          }
        });

        $scope.$apply();
      };
    }
  ])

  .controller('RegionDetailCtrl', ['$scope', '$routeParams', '$localStorage', 'Settings', '$window',
    function ($scope, $routeParams, $localStorage, Settings, $window) {
      $scope.region = (Settings.regions.filter(function (region) {
        return $routeParams.id === region.id;
      }))[0];
      $scope.tests = $localStorage[$scope.region.id];
      $scope.navBack = function () {
        $window.history.back();
      };
    }
  ])
