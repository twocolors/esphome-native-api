const EventEmitter = require("events");
const Mdns = require("multicast-dns");

class EsphomeDescovery extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.response = this._response.bind(this);
  }

  run() {
    this.mdns = Mdns(this.options);
    this.mdns.on("response", this.response);
    this.mdns.query({
      questions: [
        { name: "_esphomelib._tcp.local", type: "ANY" },
      ],
    });
  }

  destroy() {
    if (this.mdns) {
      this.mdns.off("response", this.response);
      this.mdns.destroy();
    }
    delete this.mdns;
  }

  _response(response, rinfo) {
    let device = {};
    if (response.rcode === "NOERROR") {
      // PTR - record
      const PTR = response.answers.find(
        ({ type, name }) => type === "PTR" && name === "_esphomelib._tcp.local"
      );
      if (PTR) {
        // bad hack for esp32 ...
        if (response.answers.length >= response.additionals.length) {
          response.additionals = response.additionals.concat(response.answers);
        }
        // parsed record
        response.additionals.find(({ name, type, data }) => {
          // A
          if (type === "A") {
            device.host = name;
          }
          // TXT
          if (type === "TXT") {
            data
              .toString()
              .split(",")
              .map((e) => {
                let array = e.split("=");
                device[array[0]] = array[1];
              });
          }
          // SRV
          if (type === 'SRV') {
            device.port = data.port;
          }
        });

        device = { ...device, address: rinfo.address, family: rinfo.family };

        this.emit("info", device);
      }
    }
  }
}

module.exports = new Proxy(EsphomeDescovery, {
  async apply(target, thisArg, [{ timeout = 5, ...options } = {}]) {
    return new Promise((resolve) => {
      const devices = [];
      const discovery = new target(options);
      discovery.on("info", (info) => devices.push(info));
      discovery.run();
      setTimeout(() => {
        discovery.destroy();
        resolve(devices);
      }, timeout * 1000);
    });
  },
});
