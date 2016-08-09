# px-drawer [![Build Status](https://travis-ci.org/PredixDev/px-drawer.svg?branch=master)](https://travis-ci.org/PredixDev/px-drawer)


## Usage
The following is how to use the component.

```
$ bower install --save px-drawer
```


```
<link rel="import" href="../px-drawer/px-drawer.html">
<style is="custom-style">
  :root{
    --px-drawer:{
      background-color: #000;
    }
  }
</style>
<px-drawer id="drawer1" fixed overlay>
  <p>
    This is content inside of the drawer
  </p>
</px-drawer>
<button onclick="document.getElementById('drawer1').toggle()">
  Toggle
</button>
```

## Development
The following is how to develop on this component.

1. Clone repository

  ```
  $ git clone
  ```

2. Install dependencies

  ```
  $ npm install
  ```

3. Start local server

  ```
  $ npm start
  ```

4. Compile styles

  ```
  $ npm run build
  ```


5. Run tests

  ```
  $ npm test
  ```
