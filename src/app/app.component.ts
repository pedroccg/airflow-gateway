import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { interval, Subject, switchMap, takeUntil } from 'rxjs';
import { VisNetworkService, Data, DataSet, Node, Options, Edge } from 'ngx-vis';
import { ViewChild } from '@angular/core';
//import * as d3 from 'd3'



@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {


  public visNetworkOptions!: Options



  fileContent: string | ArrayBuffer | null = null;

  dagId: string = 'spark_cd_to_lpg';
  dagRunId: string = '';
  results = '';
  subscription: any;

  jsonString = ''

  jsonData: any;
  visData_1: any;
  visData_2: any;

  readyToShow: boolean = false;
  visNetworks: any[] = [];
  loadingData: boolean = false;


  

 

  constructor(private http: HttpClient, private visNetworkService: VisNetworkService) {

    // this.visNetworkOptions = {
    //   interaction:{
    //     zoomView: true,
    //   },
    //   physics: true,
    //   layout: {
    //     randomSeed: undefined,
    //     improvedLayout:true,
    //     clusterThreshold: 150,
    //     hierarchical: {
    //       enabled:false,
    //       levelSeparation: 150,
    //       nodeSpacing: 100,
    //       treeSpacing: 200,
    //       blockShifting: true,
    //       edgeMinimization: true,
    //       parentCentralization: true,
    //       direction: 'UD',        // UD, DU, LR, RL
    //       sortMethod: 'hubsize',  // hubsize, directed
    //       shakeTowards: 'leaves'  // roots, leaves
    //     }
    //   }
      
    // }
 
  }

  public networkInitialized(visNetwork: any): void {

  
    console.log('Seed:', this.visNetworkService);
    

    this.visNetworkService.on(visNetwork.id, 'click');

  // open your console/dev tools to see the click params
  this.visNetworkService.click.subscribe((eventData: any[]) => {
    if (eventData[0] === visNetwork.id) {
      console.log(eventData);
    }
  });
}

  ngOnInit() {
    // just for testing
    this.loadJsonData();
  }

  loadJsonData() {
    this.http.get<any[]>('assets/jsons/tpch.json').subscribe((jsonDatas) => {
      jsonDatas.forEach((jsonData, index) => {
        const visData = this.convertJsonToVisData(jsonData);
        const nodes = visData.nodes;
        const edges = visData.edges;
        const name = jsonData.pattern;

        
  
        this.visNetworks.push({
          name: name,
          id: `visNetwork_${index + 1}`,
          data: { nodes: nodes, edges: edges },
          options: {
            interaction:{
              zoomView: true,
            },
            physics: true,
            layout: {
              randomSeed: 1,
              improvedLayout: true,
              hierarchical: {
                  enabled: false,
                  levelSeparation: 150,
                  nodeSpacing: 110,
                  treeSpacing: 200,
                  blockShifting: false,
                  edgeMinimization: true,
                  parentCentralization: true,
                  direction: "LR",
                  sortMethod: "directed",
                  shakeTowards: "roots"
              }
          }
          }
        });
      });
      this.readyToShow = true;
      // testing only
      this.dagRunId = 'asdasd'
      //this.loadingData = true;

    });
  }

  public ngOnDestroy(): void {
    //this.visNetworkService.off(this.visNetwork, 'click');
  }

  private createAuthorizationHeader(): HttpHeaders {
    const username = 'airflow';
    const password = 'airflow';
    const encodedCredentials = btoa(`${username}:${password}`);
    const headers = new HttpHeaders().set('Authorization', `Basic ${encodedCredentials}`);
    return headers;
  }

  startDag() {
    const url = 'http://172.16.131.117:8080/api/v1/dags/spark_cd_to_lpg/dagRuns';
    const headers = this.createAuthorizationHeader();
    return this.http.post(url, {}, { headers }).subscribe(
      res => console.log('Job started successfully', res),
      err => console.error('Error starting job', err)
    );
  }

  convertJsonToVisData(jsonData: any) {
    const nodesData = jsonData.nodes.map((node: any) => ({
      id: node.id,
      label: node.label,
      title: 'Title of Node 5' 
    }));

    const edgesData = jsonData.edges.map((edge: any) => ({
      id: edge.id,
      from: edge.source,
      to: edge.target,
      label: edge.label,
      arrows: edge.arrow
    }));

    return {
      nodes: new DataSet(nodesData),
      edges: new DataSet(edgesData)
    };
  }

  async startJob(): Promise<void> {

    if (!this.fileContent) {
      return;
    }

    const dagId = 'spark_cd_to_lpg';
    const airflowUrl = 'http://172.16.131.117:8080';
    const apiUrl = `/api/v1/dags/${dagId}/dagRuns`;
    const headers = this.createAuthorizationHeader();

    const conf = {
      "conf": {
        "file_content": this.fileContent
      }
    };

    this.http.post(`${airflowUrl}${apiUrl}`, conf, { headers }).subscribe({
      next: (res: any) => {
        this.dagRunId = res.dag_run_id
        console.log('Job started successfully:', res.dag_run_id);
      },
      error: (err: any) => {
        console.error('Error starting job', err);
      }
    });
  }

  getDagRun(dagId: string, dagRunId: string): void {
    const airflowUrl = 'http://172.16.131.117:8080';
    const apiUrl = `/api/v1/dags/${dagId}/dagRuns/${dagRunId}`;

    // Replace 'username' and 'password' with your actual credentials
    const username = 'airflow';
    const password = 'airflow';
    const base64Credentials = btoa(`${username}:${password}`);

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Basic ${base64Credentials}`,
    });

    // Check every 5 seconds
    const checkInterval = 1000;
    const stopChecking$ = new Subject<void>();

    this.loadingData = true;


    interval(checkInterval)
      .pipe(
        takeUntil(stopChecking$), // Stop checking when the job is finished
        // Switch to the GET request for each interval tick
        switchMap(() => this.http.get(`${airflowUrl}${apiUrl}`, { headers }))
      )
      .subscribe({
        next: (res: any) => {
          if (res.state === 'success') {
            // when dag is over
            //this.loadJsonData();
            stopChecking$.next(); // Stop checking when the job is finished
          }
          else if (res.state === 'failed') { 
            this.loadingData = false;
            
          } else {
            console.log('Job is not finished yet, current state:', res.state);
          }
        },
        error: (err: any) => {
          console.error('Error fetching DAG run details', err);
        }
      });
  }


  title = 'An Automated Patterns-based Model-to-Model Mapping and Transformation System for Labeled Property Graphs';
  selectedFile: File | null = null;

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.fileContent = reader.result;
    };
    reader.readAsText(file);
  }

}