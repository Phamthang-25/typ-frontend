pipeline {
  agent { label 'agent-lab' }

  environment {
    IMAGE_NAME = 'thang05/typ-frontend'
    DOCKER_HUB_CREDENTIALS = 'dockerhub-creds'
    GITHUB_CREDENTIALS = 'git-hub'
    CONFIG_REPO_URL = 'https://github.com/Phamthang-25/typ-frontend-config.git'
    VALUES_FILE = 'helm-values/values-prod.yaml'
    BRANCH = 'main'
  }

  triggers {
    GenericTrigger(
      token: 'typ-fe',
      causeString: 'Triggered by GitHub ref: $GH_REF',

      genericVariables: [
        // GitHub push/create đều có "ref" (push: "refs/tags/vX" hoặc "refs/heads/main")
        [key: 'GH_REF', value: '$.ref'],
        // GitHub create event có ref_type ("tag"/"branch"), push event thường không có
        [key: 'GH_REF_TYPE', value: '$.ref_type']
      ],

      printContributedVariables: true,
      printPostContent: true,

      // Filter theo ref bắt đầu bằng refs/tags/
      regexpFilterText: '$GH_REF',
      regexpFilterExpression: '^refs/tags/.*'
    )
  }

  stages {

    stage('Agent Information') {
      steps {
        echo "Running on agent: ${env.NODE_NAME}"
        echo "Workspace: ${env.WORKSPACE}"
        sh 'whoami'
        sh 'pwd'
        sh 'uname -a'
        sh 'docker --version'
        sh 'git --version'
      }
    }

    stage('Checkout Source Code') {
      steps {
        echo "Cloning source code..."
        checkout scm
        echo "Clone completed!"
        sh 'ls -la'
      }
    }

    stage('Resolve Tag') {
      steps {
        script {
          echo "Webhook payload vars: GH_REF='${env.GH_REF}', GH_REF_TYPE='${env.GH_REF_TYPE}'"

          // Nếu webhook có ref dạng refs/tags/<tag> thì strip prefix để lấy tag sạch
          if (env.GH_REF?.trim()) {
            def ref = env.GH_REF.trim()

            if (ref.startsWith('refs/tags/')) {
              env.TAG_NAME = ref.replace('refs/tags/', '').trim()
              echo "Resolved tag from webhook ref: ${env.TAG_NAME}"
            } else {
              echo "Webhook ref is not a tag ref ('${ref}'). Fallback to git describe..."
            }
          } else {
            echo "No GH_REF from webhook. Fallback to git describe..."
          }

          // Fallback khi build manual hoặc webhook không đủ dữ liệu
          if (!env.TAG_NAME?.trim()) {
            sh 'git fetch --tags --force || true'

            def tagVersion = sh(
              script: '''
                git describe --tags --exact-match 2>/dev/null \
                || git describe --tags --abbrev=0 2>/dev/null \
                || git rev-parse --short HEAD
              ''',
              returnStdout: true
            ).trim()

            env.TAG_NAME = tagVersion
            echo "Using fallback version: ${env.TAG_NAME}"
          }

          echo "Docker image will be: ${env.IMAGE_NAME}:${env.TAG_NAME}"
        }
      }
    }

    stage('Checkout Tag (tag build)') {
      steps {
        script {
          // Nếu có TAG_NAME thì checkout tag luôn để đảm bảo build đúng source của tag
          if (env.TAG_NAME?.trim()) {
            echo "Checking out tag: ${env.TAG_NAME}"
            sh """
              git fetch --tags --force
              git checkout -f tags/${env.TAG_NAME}
              echo "HEAD after checkout:"
              git rev-parse HEAD
              git describe --tags --exact-match || true
            """
          } else {
            error("TAG_NAME is empty -> cannot checkout tag")
          }
        }
      }
    }

    stage('Build Docker Image') {
      steps {
        script {
          echo "Building Docker image: ${env.IMAGE_NAME}:${env.TAG_NAME}"
          sh """
            docker build -t ${env.IMAGE_NAME}:${env.TAG_NAME} .
            docker tag ${env.IMAGE_NAME}:${env.TAG_NAME} ${env.IMAGE_NAME}:latest
          """
          echo "Docker image built successfully!"
          sh "docker images | grep ${env.IMAGE_NAME} || true"
        }
      }
    }

    stage('Push to Docker Hub') {
      steps {
        script {
          echo "Pushing image to Docker Hub..."
          withCredentials([usernamePassword(
            credentialsId: env.DOCKER_HUB_CREDENTIALS,
            passwordVariable: 'DOCKER_PASSWORD',
            usernameVariable: 'DOCKER_USERNAME'
          )]) {
            sh 'echo $DOCKER_PASSWORD | docker login -u $DOCKER_USERNAME --password-stdin'
          }

          sh """
            docker push ${env.IMAGE_NAME}:${env.TAG_NAME}
            docker push ${env.IMAGE_NAME}:latest
          """
          echo "Successfully pushed to Docker Hub!"
        }
      }
    }

    stage('Clone Config Repo') {
      steps {
        script {
          echo "Cloning config repository..."
          sh 'rm -rf config-repo && mkdir -p config-repo'

          dir('config-repo') {
            withCredentials([gitUsernamePassword(credentialsId: env.GITHUB_CREDENTIALS, gitToolName: 'Default')]) {
              sh """
                git clone ${env.CONFIG_REPO_URL} .
                git checkout ${env.BRANCH}
                git config user.email "jenkins@local"
                git config user.name "Jenkins CI/CD Frontend"
              """
            }
            sh 'ls -la'
          }
        }
      }
    }

    stage('Update Helm Values') {
      steps {
        script {
          dir('config-repo') {
            echo "Updating ${env.VALUES_FILE} with tag: ${env.TAG_NAME}"
            sh """
              sed -i 's/^  tag:.*/  tag: "${env.TAG_NAME}"/' ${env.VALUES_FILE}
              echo "After update:"
              grep -n 'tag:' ${env.VALUES_FILE} || true
            """
          }
        }
      }
    }

    stage('Push Config Changes') {
      steps {
        script {
          dir('config-repo') {
            def gitStatus = sh(script: 'git status --porcelain', returnStdout: true).trim()

            if (gitStatus) {
              echo "Changes detected, committing and pushing..."
              sh """
                git add ${env.VALUES_FILE}
                git commit -m "Update frontend image tag to ${env.TAG_NAME} (build ${env.BUILD_NUMBER})"
              """
              withCredentials([gitUsernamePassword(credentialsId: env.GITHUB_CREDENTIALS, gitToolName: 'Default')]) {
                sh "git push origin ${env.BRANCH}"
              }
              echo "Config changes pushed successfully!"
            } else {
              echo "No changes detected in config repo"
            }
          }
        }
      }
    }
  }

  post {
    always {
      echo "Cleaning up..."
      sh """
        docker logout || true
        docker rmi ${env.IMAGE_NAME}:${env.TAG_NAME} || true
        docker rmi ${env.IMAGE_NAME}:latest || true
        docker system prune -f || true
      """
      cleanWs()
    }
    success {
      echo "BUILD SUCCESS!"
      echo "Image pushed: ${env.IMAGE_NAME}:${env.TAG_NAME}"
      echo "Config repo updated: ${env.CONFIG_REPO_URL}"
    }
    failure {
      echo "BUILD FAILED! Please check logs."
    }
  }
}