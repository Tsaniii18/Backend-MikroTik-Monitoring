import axios from "axios";

const client = axios.create({
  baseURL: "http://192.168.122.119:8080/rest",
  auth: { username: "admin", password: "admin" },
  timeout: 20000,
  headers: {
    "Content-Type": "application/json"
  }
});

async function systemIdentity() {
  try {
    const res = await client.get("/system/identity");
    console.log("system/identity Raw:");
    console.dir(res.data, { depth: null, colors: true });
  } catch (e) {
    console.log("Err:", e.message);
    if (e.response) {
      console.log("Status:", e.response.status);
      console.log("Data:", e.response.data);
    }
  }
}

async function systemResource() {
  try {
    const res = await client.get("/system/resource");
    console.log("system/resource Raw:");
    console.dir(res.data, { depth: null, colors: true });
  } catch (e) {
    console.log("Err:", e.message);
    if (e.response) {
      console.log("Status:", e.response.status);
      console.log("Data:", e.response.data);
    }
  }
}

async function interfaces() {
  try {
    const res = await client.get("/interface");
    console.log("interface Raw:");
    console.dir(res.data, { depth: null, colors: true });
  } catch (e) {
    console.log("Err:", e.message);
    if (e.response) {
      console.log("Status:", e.response.status);
      console.log("Data:", e.response.data);
    }
  }
}

async function ping() {
  try {
    const res = await client.post("/tool/ping", {
      address: "8.8.8.8",
      count: "10",
      interval: "25ms"
    });
    console.log("tool/ping Raw:");
    console.dir(res.data, { depth: null, colors: true });
  } catch (e) {
    console.log("Err:", e.message);
    if (e.response) {
      console.log("Status:", e.response.status);
      console.log("Data:", e.response.data);
    }
  }
}

async function profile() {
  try {
    const res = await client.post("/tool/profile", {
      duration: "3s"
    });
    console.log("tool/profile Raw:");
    console.dir(res.data, { depth: null, colors: true });
  } catch (e) {
    console.log("Err:", e.message);
    if (e.response) {
      console.log("Status:", e.response.status);
      console.log("Data:", e.response.data);
    }
  }
}

async function run() {
  // await systemIdentity();
  // await systemResource();
  // await interfaces();
  await ping();
  // await profile();
}

run();