# IoT Speed Test App

A simple app which could be used to test the connection established time and message transmission time between AWS IoT (available regions) and the phone.

*Note: this app is developed in HTML5 through [Apache Cordova](http://cordova.apache.org/). So to build it, you should be familier with HTML5 and Apache Cordova (you actually should be also familiar with node/npm).*

## Build the App

Before you could have a working app, you should have an AWS account and created an IAM user with policy `AWSIoTFullAccess`. Then use the user's accessKeyId and secretKey in file www/js/index.js.

```javascript
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
```

### Prepare js libraries

Change to www directory and use bower to download js libraries.

```bash
cd www
bower install
```
### Build Android App

Change to project root directory and use cordova command to build the app (in debug or release mode).

```bash
cd ..
cordova build android
```

### Build iOS App

You will need a Mac and XCode to build iOS app. Launch Xcode and open project IoTSpeed.xcodeproj in directory `platforms/ios`, and then build it like normal iOS project.
