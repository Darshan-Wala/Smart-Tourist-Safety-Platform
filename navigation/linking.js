// Optional deep linking configuration.
// Add "scheme": "smarttourist" to app.json if you use this.
const linking = {
  prefixes: ['smarttourist://', 'https://smart.tourist.app'],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
          Register: 'register'
        }
      },
      App: {
        screens: {
          Tabs: {
            screens: {
              Home: 'home',
              Trips: 'trips',
              Explore: 'explore',
              Profile: 'profile'
            }
          },
          DigitalIDModal: 'digital-id'
        }
      }
    }
  }
};

export default linking;