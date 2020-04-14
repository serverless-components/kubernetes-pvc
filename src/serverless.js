const kubernetes = require('@kubernetes/client-node')
const { Component } = require('@serverless/core')

const defaults = {
  namespace: 'default'
}

class KubernetesPersistentVolumeClaim extends Component {
  async deploy(inputs = {}) {
    const config = {
      ...defaults,
      ...inputs
    }

    const k8sCore = this.getKubernetesClient(kubernetes.CoreV1Api)

    let pvcExists = true
    try {
      await this.readPersistentVolumeClaim(k8sCore, config)
    } catch (error) {
      pvcExists = error.response.body.code === 404 ? false : true
    }

    if (!pvcExists) {
      await this.createPersistentVolumeClaim(k8sCore, config)
    }

    this.state = config
    return this.state
  }

  async read(inputs = {}) {
    const config = {
      ...defaults,
      ...inputs
    }

    const k8sCore = this.getKubernetesClient(kubernetes.CoreV1Api)

    const result = await this.readPersistentVolumeClaim(k8sCore, config)
    return {
      metadata: {
        uid: result.body.metadata.uid,
        name: result.body.metadata.name,
        namespace: result.body.metadata.namespace
      },
      status: {
        phase: result.body.status.phase,
        capacity: result.body.status.capacity,
        conditions: result.body.status.conditions
      }
    }
  }

  async remove(inputs = {}) {
    const config = {
      ...defaults,
      ...inputs,
      ...this.state
    }

    const k8sCore = this.getKubernetesClient(kubernetes.CoreV1Api)

    await this.deletePersistentVolumeClaim(k8sCore, config)

    this.state = {}
    return {}
  }

  // "private" methods
  getKubernetesClient(type) {
    const { endpoint, port } = this.credentials.kubernetes
    const token = this.credentials.kubernetes.serviceAccountToken
    const skipTLSVerify = this.credentials.kubernetes.skipTlsVerify == 'true'
    const kc = new kubernetes.KubeConfig()
    kc.loadFromOptions({
      clusters: [
        {
          name: 'cluster',
          skipTLSVerify,
          server: `${endpoint}:${port}`
        }
      ],
      users: [{ name: 'user', token }],
      contexts: [
        {
          name: 'context',
          user: 'user',
          cluster: 'cluster'
        }
      ],
      currentContext: 'context'
    })
    return kc.makeApiClient(type)
  }

  async createPersistentVolumeClaim(k8s, { name, namespace, spec }) {
    return k8s.createNamespacedPersistentVolumeClaim(namespace, {
      metadata: { name },
      spec
    })
  }

  async readPersistentVolumeClaim(k8s, { name, namespace }) {
    return k8s.readNamespacedPersistentVolumeClaim(name, namespace)
  }

  async deletePersistentVolumeClaim(k8s, { name, namespace }) {
    return k8s.deleteNamespacedPersistentVolumeClaim(name, namespace)
  }
}

module.exports = KubernetesPersistentVolumeClaim
