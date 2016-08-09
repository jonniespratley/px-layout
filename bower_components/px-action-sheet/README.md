# px-action-sheet

## Overview

px-action-sheet is a Predix UI component that provides the ability to show/hide actions.

## Usage

### Prerequisites
1. node.js
2. npm
3. bower
4. [webcomponents-lite.js polyfill](https://github.com/webcomponents/webcomponentsjs)

Node, npm and bower are necessary to install the component and dependencies. webcomponents.js adds support for web components and custom elements to your application.

## Getting Started

First, install the component via bower on the command line.

```
bower install px-action-sheet --save
```

Second, import the component to your application with the following tag in your head.

```
<link rel="import" href="/bower_components/px-action-sheet/px-action-sheet.html"/>
```

Finally, use the component in your application:

```

<button class="btn--large btn btn--tertiary btn--full" type="button" onclick="document.getElementById('actionsheet2').toggle()">
  List Action Sheet
</button>

<px-action-sheet id="actionsheet2" list>
  <div class="u-m--">
    <h3>Open in</h3>
  </div>
  <px-action-sheet-button label="Github" icon="fa fa-lg fa-github"></px-action-sheet-button>
  <px-action-sheet-button label="Facebook" icon="fa fa-lg fa-facebook"></px-action-sheet-button>
  <px-action-sheet-button label="Twitter" icon="fa fa-lg fa-twitter"></px-action-sheet-button>
  <px-action-sheet-button label="Linked In" icon="fa fa-lg fa-linkedin"></px-action-sheet-button>
</px-action-sheet>
```

<br />
<hr />

## Documentation

Read the full API and view the demo [here](https://predixdev.github.io/px-action-sheet).

The documentation in this repository is supplemental to the official Predix documentation, which is continuously updated and maintained by the Predix documentation team. Go to [http://predix.io](http://predix.io)  to see the official Predix documentation.


## Local Development

From the component's directory...

```
$ npm install
$ bower install
$ grunt sass
```

From the component's directory, to start a local server run:

```
$ grunt depserve
```

Navigate to the root of that server (e.g. http://localhost:8080/) in a browser to open the API documentation page, with link to the "Demo" / working examples.


### DevMode
Devmode runs `grunt depserve` and `grunt watch` concurrently so that when you make a change to your source files and save them, your preview will be updated in any browsers you have opened and turned on LiveReload.
From the component's directory run:

```
$ grunt devmode
```

### GE Coding Style Guide
[GE JS Developer's Guide](https://github.com/GeneralElectric/javascript)

<br />
<hr />

## Known Issues

Please use [Github Issues](https://github.com/PredixDev/px-action-sheet/issues) to submit any bugs you might find.
