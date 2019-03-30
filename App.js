/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 */

import React, {Component} from 'react';
import {Platform, StyleSheet, Text, View} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import Button from 'react-native-button';
import {decode as atob, encode as btoa} from 'base-64';

const instructions = Platform.select({
  ios: 'Press Cmd+R to reload,\n' + 'Cmd+D or shake for dev menu',
  android:
    'Double tap R on your keyboard to reload,\n' +
    'Shake or press menu button for dev menu',
});

const UUIDS = {
  IP_ADDRESS: '00000004-94f3-4011-be53-6ac36bf22cf1',
  IS_AUTHORISED: '00000001-94f3-4011-be53-6ac36bf22cf1',
  BIG_DATA: '00000003-94f3-4011-be53-6ac36bf22cf1',
  CMD: '00000002-94f3-4011-be53-6ac36bf22cf1'
}

export default class App extends Component {

  state = {
    deviceName: '',
    connected: false,
    connecting: false,
    found: false,
    finding: false,
    ready: false,
    requestingIP: false,
    pairing: false
  }

  constructor(props) {
    super(props);
    this.manager = new BleManager();
  }

  componentWillMount() {
    const subscription = this.manager.onStateChange((state) => {
      if (state === 'PoweredOn') {
        this.scanAndConnect();
        subscription.remove();
      }
    }, true);
  }

  componentWillUnmount() {
    this.device.cancelConnection().then(data => {
      console.log("Disconnected " + this.device.name + " from the app.");
    });
  }

  getIpAddress = async () => {
    this.setState({ requestingIP: true });

    const ipCharacteristic = this.allCharacteristics.find(characteristic => characteristic.uuid === UUIDS.IP_ADDRESS);

    if(ipCharacteristic) {
      console.log(ipCharacteristic);
      try {
        const ip = await ipCharacteristic.read();
        console.log("ip", atob(ip.value));
      } catch (err) {
        console.error(err);
      }

      this.setState({ requestingIP: false });    
    }
  }

  scanAndConnect = () => {
    console.log("Start device scanning...");

    this.setState({ found: false, finding: true });
    this.manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
          console.error(error);
          // Handle error (scanning will be stopped automatically)
          return
      }

      if (!!device.name)
        console.log(device.name);

      // Check if it is a device you are looking for based on advertisement data
      // or other criteria.
      if (device.name === 'RaspberryPI Backpack Pro') {
          // Stop scanning as it's not necessary if you are scanning for one device.
          this.manager.stopDeviceScan();

          console.log("Device Found");
          console.log("Connecting to device...");

          this.setState({ found: true, finding: false, connecting: true });

          // Proceed with connection.
          device.connect()
          .then((device) => {
            this.device = device;
            console.log("Connected to " + device.name);
            this.setState({ connecting: false, connected: true, deviceName: device.name });
            console.log("Scanning Services and Characteristics for " + device.name);
            return device.discoverAllServicesAndCharacteristics()
          })
          .then((device) => {
            console.log("S+C Scan Complete for " + device.name);
          
            device.services().then(async (services) => {
              console.log("services", services);
              
              const characteristics = await Promise.all(services.map(service => service.characteristics()));
              console.log(characteristics);
              let allCharacteristics = [];
              
              characteristics.map(characteristic => {
                allCharacteristics = [
                  ...allCharacteristics,
                  ...characteristic
                ];
              });

              this.allCharacteristics = allCharacteristics;
              this.setState({ ready: true });
            });
            // Do work on device with services and characteristics
          })
          .catch((error) => {
            console.log(error);
              // Handle errors
          });
      }
    });
  }

  onPressPair = async () => {
    this.setState({ pairing: true });
    const pairingCharacteristic = this.allCharacteristics.find(characteristic => characteristic.uuid === UUIDS.CMD);
    const isAuthorisedCharacteristic = this.allCharacteristics.find(characteristic => characteristic.uuid === UUIDS.IS_AUTHORISED);
    const bigDataCharacteristic = this.allCharacteristics.find(characteristic => characteristic.uuid === UUIDS.BIG_DATA);
    console.log(isAuthorisedCharacteristic);
    console.log(pairingCharacteristic);

    pairingCharacteristic.writeWithResponse(btoa('1'))
    .then(data => bigDataCharacteristic.read())
    .then(isAuth => {
      console.log(isAuth);
      // console.log(atob(isAuth.value));
      this.setState({ pairing: false });
    })
    .catch(err => console.error(err));
  }

  turnLedOn = async () => {
    const cmd = this.allCharacteristics.find(characteristic => characteristic.uuid === UUIDS.CMD);

    if(cmd) {
      console.log(cmd);
      try {
        const response = await cmd.writeWithResponse(btoa('5'));
        console.log(response);
      } catch (err) {
        console.error(err);
      }
    }
  }

  render() {
    const { connected, deviceName, connecting, finding, found, ready, pairing, requestingIP } = this.state;

    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>Backpack App</Text>
        { finding && (
           <Text style={styles.welcome}>Finding...</Text>
        ) }
        { found && (
           <Text style={styles.welcome}>Backpack Found</Text>
        ) }
        { connecting && (
           <Text style={styles.welcome}>Connecting...</Text>
        ) }
        <Text style={styles.welcome}>{connected ? `${deviceName}`: 'Not Connected'}</Text>

        {ready && (
          <>    
            <Button
              onPress={this.onPressPair}
              style={styles.button}
              styleDisabled={styles.disabledButton}
              disabled={pairing}
            >
              {pairing ? 'Pairing...' : 'Pair'}
            </Button>
            <Button
              onPress={this.getIpAddress}
              style={styles.button}
              styleDisabled={styles.disabledButton}
              disabled={requestingIP}
            >
              Get IP Address
            </Button>
            <Button
              onPress={this.turnLedOn}
              style={styles.button}
            >
              Turn LED On
            </Button>
            {/* <Button
              onPress={this.turnLedOn}
              style={styles.button}
              styleDisabled={styles.disabledButton}
            >
              TURN LED ON
            </Button> */}
          </>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
  button: {
    backgroundColor: 'cyan',
    color: '#fff',
    margin: 30,
    padding: 15
  },
  disabledButton: {
    backgroundColor: '#bbb',
    color: '#fff',
    margin: 30,
    padding: 15
  }
});
