```bash
$ npm install -g protoc
$ protoc --version
libprotoc 3.20.3

$ wget -c https://raw.githubusercontent.com/esphome/aioesphomeapi/main/aioesphomeapi/api_options.proto
$ wget -c https://raw.githubusercontent.com/esphome/aioesphomeapi/main/aioesphomeapi/api.proto
$ protoc --js_out=import_style=commonjs:. api_options.proto api.proto
```
