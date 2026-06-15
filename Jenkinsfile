// ============================================================
//  Jenkinsfile — Banking API (Koa.js + TypeScript)
//  Pipeline completo: CI + Deploy local persistente
// ============================================================
//
//  Requisitos en Jenkins:
//    - Plugin: SonarQube Scanner, NodeJS, Workspace Cleanup
//    - Tool: nodejs "node24"
//    - Credentials:
//        sonarqube-token   → Secret text  (token de SonarQube)
//        github-pat-git    → Username/password (GitHub PAT)
//        banking-db-pass   → Secret text  (banking_pass)
//        banking-jwt-secret→ Secret text  (tu JWT secret)
//    - SonarQube Server: "sonarqube-local" → http://devsecops-sonarqube:9000

pipeline {
    agent any

    triggers {
        pollSCM('H/5 * * * *')
    }

    tools {
        nodejs 'node24'
    }

    environment {
        SONAR_PROJECT_KEY  = 'personal'
        SONAR_PROJECT_NAME = 'banking-api'
        APP_IMAGE          = 'personal:latest'
        APP_CONTAINER      = 'banking-api'
        APP_NETWORK        = 'banking-api_default'
        APP_PORT           = '3000'
    }

    stages {

        // ── 1. Checkout ──────────────────────────────────────
        stage('Checkout') {
            steps {
                checkout scm
                echo "Rama: ${env.GIT_BRANCH ?: 'main'} — Commit: ${env.GIT_COMMIT?.take(7)}"
            }
        }

        // ── 2. Instalar dependencias ─────────────────────────
        stage('Install dependencies') {
            steps {
                sh 'npm install -g pnpm'
                sh 'pnpm install --frozen-lockfile'
            }
        }

        // ── 3. Tests ─────────────────────────────────────────
        stage('Tests') {
            steps {
                script {
                    // MODO ACTUAL: no bloquea si no hay tests
                    def result = sh(script: 'npm test 2>&1 || true', returnStdout: true).trim()
                    echo "Test output:\n${result}"
                    if (result.contains('missing script: test')) {
                        echo '⚠️  Sin script de test — se omite'
                    }
                }
            }
            // ── Para hacer tests OBLIGATORIOS en el futuro: ──
            // steps { sh 'npm test' }
            // Y agregar Jest con coverage en package.json
        }

        // ── 4. Análisis SonarQube ────────────────────────────
        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('sonarqube-local') {
                    withCredentials([string(credentialsId: 'sonarqube-token', variable: 'SONAR_TOKEN')]) {
                        sh """
                            npx @sonar/scan \
                              -Dsonar.projectKey=${SONAR_PROJECT_KEY} \
                              -Dsonar.projectName="${SONAR_PROJECT_NAME}" \
                              -Dsonar.sources=. \
                              -Dsonar.exclusions=**/node_modules/**,**/dist/**,**/*.test.*,**/*.spec.*,sonar-project.properties \
                              -Dsonar.host.url=http://devsecops-sonarqube:9000
                        """
                        // ── Con coverage de Jest en el futuro: ──
                        // -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
                        // -Dsonar.typescript.lcov.reportPaths=coverage/lcov.info
                    }
                }
            }
        }

        // ── 5. Quality Gate ──────────────────────────────────
        stage('Quality Gate') {
            steps {
                sleep(time: 50, unit: 'SECONDS')
                timeout(time: 5, unit: 'MINUTES') {
                    // MODO ACTUAL: no bloquea aunque falle
                    waitForQualityGate abortPipeline: false
                    // ── Para hacerlo OBLIGATORIO en el futuro: ──
                    // waitForQualityGate abortPipeline: true
                }
            }
        }

        // ── 6. Trivy — Escaneo del código fuente ────────────
        stage('Trivy — Filesystem Scan') {
            steps {
                sh """
                    docker run --rm \
                      -v \$(pwd):/scan:ro \
                      -v /root/.cache/trivy:/root/.cache/trivy \
                      aquasec/trivy:latest fs \
                        --exit-code 0 \
                        --severity HIGH,CRITICAL \
                        --format table \
                        --table-mode summary \
                        --scanners vuln,secret \
                        /scan
                """
            }
        }

        // ── 7. Build de imagen Docker ────────────────────────
        stage('Docker Build') {
            steps {
                sh "docker build -t ${APP_IMAGE} ."
                echo "✅ Imagen ${APP_IMAGE} construida"
            }
        }

        // ── 8. Trivy — Escaneo de la imagen ─────────────────
        stage('Trivy — Image Scan') {
            steps {
                sh """
                    docker run --rm \
                      -v /var/run/docker.sock:/var/run/docker.sock \
                      -v /root/.cache/trivy:/root/.cache/trivy \
                      aquasec/trivy:latest image \
                        --exit-code 0 \
                        --severity HIGH,CRITICAL \
                        --format table \
                        --table-mode summary \
                        personal:latest
                """
            // ── Para BLOQUEAR en CRITICAL: cambia --exit-code 0 por --exit-code 1
            }
        }

        // ── 9. Deploy local persistente ──────────────────────
        stage('Deploy Local') {
            steps {
                withCredentials([
                    string(credentialsId: 'banking-db-pass',    variable: 'DB_PASSWORD'),
                    string(credentialsId: 'banking-jwt-secret', variable: 'JWT_SECRET')
                ]) {
                    sh """
                        # Elimina el container anterior si existe (sin error si no existe)
                        docker rm -f ${APP_CONTAINER} || true

                        # Corre el nuevo container — persiste hasta el próximo build
                        docker run -d \
                          --name ${APP_CONTAINER} \
                          --restart unless-stopped \
                          --network ${APP_NETWORK} \
                          -e PORT=${APP_PORT} \
                          -e NODE_ENV=development \
                          -e DB_HOST=banking_db \
                          -e DB_PORT=5432 \
                          -e DB_NAME=banking \
                          -e DB_USER=banking_user \
                          -e DB_PASSWORD=${DB_PASSWORD} \
                          -e DB_POOL_MIN=2 \
                          -e DB_POOL_MAX=10 \
                          -e JWT_SECRET=${JWT_SECRET} \
                          -e JWT_EXPIRES_IN=1h \
                          -e BCRYPT_ROUNDS=10 \
                          -e BCRYPT_PASSWORD=password123 \
                          -p ${APP_PORT}:${APP_PORT} \
                          ${APP_IMAGE}

                        # Espera que la app levante y conecte a la BD
                        sleep 8

                        # Smoke test — verifica el health endpoint
                        docker exec ${APP_CONTAINER} wget -qO- http://localhost:${APP_PORT}/health

                        echo ""
                        echo "✅ Deploy exitoso"
                        echo "🌐 API disponible en http://localhost:${APP_PORT}"
                        echo "🔍 Health: http://localhost:${APP_PORT}/health"
                    """
                }
            }
        }

    }

    post {
        success {
            echo '✅ Pipeline completado — API desplegada en http://localhost:3000'
        }
        failure {
            echo '❌ Pipeline falló — revisa el Console Output'
            // Limpia el container si el deploy falló a mitad
            sh 'docker rm -f banking-api || true'
        }
        always {
            cleanWs()
        }
    }
}
