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
      ) || response.additionals.find(
        ({ type, name }) => type === "PTR" && name === "_esphomelib._tcp.local"
      );
      if (PTR) {
        if (typeof response.answers !== undefined) {
          device = { ...device, ...this._parse(response.answers)};
        }
        if (typeof response.additionals !== undefined) {
          device = { ...device, ...this._parse(response.additionals)};
        }

        if (typeof device.address === undefined || typeof device.address6 === undefined) {
          if (typeof device.address === undefined && rinfo.family === "IPv4") {
            device.address = rinfo.address;
          }
          if (typeof device.address6 === undefined && rinfo.family === "IPv6") {
            device.address6 = rinfo.address;
          }
        }

        this.emit("info", device);
      }
    }
  }

  // parsed record
  _parse(response) {
    let device = {};
    response.find(({ name, type, data }) => {
      // A
      if (type === "A") {
        device.host = name;
        device.address = data;
      }
      // AAAA
      if (type === "AAAA") {
        device.host = name;
        device.address6 = data;
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
    return device;
  }
}

module.exports = new Proxy(EsphomeDescovery, {
  async apply(target, thisArg, [{ timeout = 5, ...options } = {}]) {
    return new Promise((resolve) => {
      const devices = [];
      const discovery = new target(options);
      discovery.on("info", (info) => {
        for (let d of devices) {
            if (JSON.stringify(d) === JSON.stringify(info)) {
                return;
            }
        }
        devices.push(info)
      });
      discovery.run();
      setTimeout(() => {
        discovery.destroy();
        resolve(devices);
      }, timeout * 1000);
    });
  },
});
