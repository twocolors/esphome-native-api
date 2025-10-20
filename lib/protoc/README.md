```bash
$ npm install -g protoc protoc-gen-js
$ protoc --version
libprotoc 33.0

$ curl https://raw.githubusercontent.com/esphome/aioesphomeapi/main/aioesphomeapi/api_options.proto -o api_options.proto
$ curl https://raw.githubusercontent.com/esphome/aioesphomeapi/main/aioesphomeapi/api.proto -o api.proto
$ protoc --js_out=import_style=commonjs:. api_options.proto api.proto
```
