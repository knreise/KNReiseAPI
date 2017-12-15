KNReiseAPI
==========

This library is a wrapper over various geospatial APIs used by "Kultur- og Naturreise".

Note
----
The version 2.x.x branch is still experimental!

Usage
-----

Install using npm:

    npm install knreise-api -S

if using webpack, add this to your config:

    node: {
        console: true,
        fs: 'empty',
        net: 'empty',
        tls: 'empty',
        dns: 'empty',
        dgram: 'empty'
    }


See [doc.md][doc] for more details.

See also this [codepen collection][codepen] for old examples of more advanced usage with Leaflet

License
-------
This library is licensed under the Apache Software License, Version 1.1, 
see LICENSE.md

Background
----------
This library is developed by Norkart on behalf of the Norwegian arts Council as
part of the ["Kultur- og naturreise demo"-project][knreise]

[knreise]: https://github.com/knreise/demonstratorer
[doc]: https://github.com/knreise/KNReiseAPI/blob/master/doc.md
[example]: http://knreise.github.io/KNReiseAPI/examples/api.html
[codepen]: http://codepen.io/collection/XJGJNL/