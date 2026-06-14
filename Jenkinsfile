// ============================================================
//  Jenkinsfile — Pipeline Koa/Node.js
//  Modo: Happy Path (no bloquea en fallos)
// ============================================================
//
//  Requisitos en Jenkins:
//    - Plugin: SonarQube Scanner
//    - Plugin: NodeJS
//    - Plugin: Workspace Cleanup
//    - Tool configurado: nodejs "node20"  (Manage Jenkins → Tools → NodeJS)
//    - Credencial: "sonarqube-token"  (Secret text)
//    - SonarQube Server: "sonarqube-local"  (Manage Jenkins → System)

pipeline {
    agent any

    triggers {
        pollSCM('H/5 * * * *')
    }

    tools {
        // ⚠️ Este nombre debe coincidir exactamente con lo que pusiste
        // en Manage Jenkins → Tools → NodeJS installations → Name
        nodejs 'node24'
    }

    environment {
        SONAR_PROJECT_KEY  = 'personal'
        SONAR_PROJECT_NAME = 'banking-api'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                echo "Rama: ${env.GIT_BRANCH ?: 'main'} — Commit: ${env.GIT_COMMIT?.take(7)}"
            }
        }

        stage('Install dependencies') {
            steps {
                sh 'npm install -g pnpm'
                // Si usas npm:  sh 'npm ci'
                // Si usas yarn: sh 'yarn install --frozen-lockfile'
                sh 'pnpm install --frozen-lockfile'
            }
        }

        stage('Tests') {
            steps {
                script {
                    // MODO ACTUAL: los tests no bloquean el pipeline
                    // Si no existe script de test en package.json, solo avisa y continúa
                    def testResult = sh(
                        script: 'npm test 2>&1 || true',
                        returnStdout: true
                    ).trim()
                    echo "Test output:\n${testResult}"

                    if (testResult.contains('missing script: test')) {
                        echo '⚠️  No hay script de test definido en package.json — se omite'
                    }
                }
            }
            // ── Para hacer los tests OBLIGATORIOS en el futuro ──────────────
            // 1. Reemplaza el bloque steps de arriba por:
            //      steps { sh 'npm test' }
            // 2. Asegúrate de tener Jest con coverage:
            //      "test": "jest --coverage"
            // 3. Descomenta el bloque post para publicar cobertura:
            // post {
            //     always {
            //         junit 'coverage/junit.xml'
            //         publishHTML([
            //             reportDir: 'coverage/lcov-report',
            //             reportFiles: 'index.html',
            //             reportName: 'Coverage Report',
            //             allowMissing: true
            //         ])
            //     }
            // }
        }

        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('sonarqube-local') {
                    withCredentials([string(credentialsId: 'sonarqube-token', variable: 'SONAR_TOKEN')]) {
                        sh """
                            npx @sonar/scan \
                              -Dsonar.projectKey=${SONAR_PROJECT_KEY} \
                              -Dsonar.projectName="${SONAR_PROJECT_NAME}" \
                              -Dsonar.sources=. \
                              -Dsonar.exclusions=**/node_modules/**,**/dist/**,**/*.test.*,**/*.spec.* \
                              -Dsonar.host.url=http://devsecops-sonarqube:9000
                        """
                        // ── Cuando tengas coverage de Jest, agrega dentro del sh: ──
                        // -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                        // -Dsonar.typescript.lcov.reportPaths=coverage/lcov.info \
                        // -Dsonar.test.inclusions=**/*.spec.ts,**/*.test.ts \
                    }
                }
            }
        }

        stage('Quality Gate') {
            steps {
                // Espera 30 segundos para que SonarQube procese el reporte
                sleep(time: 50, unit: 'SECONDS')
                timeout(time: 5, unit: 'MINUTES') {
                    // MODO ACTUAL: no bloquea aunque falle el Quality Gate
                    waitForQualityGate abortPipeline: false
                    // ── Para hacerlo OBLIGATORIO en el futuro: ──
                    // waitForQualityGate abortPipeline: true
                }
            }
        }

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
                        --scanners vuln,secret \
                        /scan
                """
                // ── Para BLOQUEAR el pipeline en vulnerabilidades CRITICAL: ──
                // Cambia --exit-code 0 por --exit-code 1
            }
        }

        stage('Trivy — Image Scan') {
            when {
                expression { fileExists('Dockerfile') }
            }
            steps {
                sh "docker build -t ${SONAR_PROJECT_KEY}:latest ."
                sh """
                    docker run --rm \
                      -v /var/run/docker.sock:/var/run/docker.sock \
                      -v /root/.cache/trivy:/root/.cache/trivy \
                      aquasec/trivy:latest image \
                        --exit-code 0 \
                        --severity HIGH,CRITICAL \
                        --format table \
                        ${SONAR_PROJECT_KEY}:latest
                """
                // ── Para BLOQUEAR el pipeline en la imagen: ──
                // Cambia --exit-code 0 por --exit-code 1
            }
        }

    }

    post {
        success {
            echo '✅ Pipeline completado exitosamente'
        }
        failure {
            echo '❌ Pipeline falló — revisa SonarQube en http://localhost:9000'
        }
        always {
            cleanWs()
        }
    }
}
