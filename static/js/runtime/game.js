let lastSourceUpdate = {};
let updateQueue = [];

function processUpdateQueue() {
  while (updateQueue.length > 0) {
    const update = updateQueue.shift();
    if (runtime && runtime.vm && runtime.updateSource) {
      runtime.updateSource(update.file, update.code, true);
    }
  }
  updateQueue = [];
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', function(event) {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      
      if (data.type === 'update' && data.file && data.code) {
        if (runtime && runtime.vm) {
          runtime.updateSource(data.file, data.code, true);
        } else {
          updateQueue.push(data);
        }
      }
    } catch (e) {
      console.error('Failed to process message:', e);
    }
  });
}
