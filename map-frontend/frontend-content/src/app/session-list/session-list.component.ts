import { Component, OnInit, OnDestroy, ViewChild, Input } from '@angular/core';
import { FormControl, FormGroup, FormArray } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { MatPaginator, MatTableDataSource, MatSort } from '@angular/material';
import { AllSessionsService } from './all-sessions.service';
import { SessionComponent } from './session/session.component';
import { FilterStoreService } from '../filter-store.service';
import * as moment from 'moment';


@Component({
  selector: 'app-session-list',
  templateUrl: './session-list.component.html',
  styleUrls: ['./session-list.component.css']
})
export class SessionListComponent implements OnInit, OnDestroy {
  session_filter_form = new FormGroup({
    clustering_methods_control : new FormControl(),
    session_control : new FormControl(),
    session_date_control : new FormControl(),
    session_range_filter: new FormGroup({
      session_range_start_control: new FormControl(),
      session_range_end_control: new FormControl()
    }),
    probe_count_control: new FormControl(),
    subject_id_control: new FormControl(),
    insert_locations_control: new FormControl(),
    // sex_control: new FormArray([new FormControl(), new FormControl(), new FormControl()]),
    // subject_birth_date_control: new FormControl(),
    water_restriction_number_control: new FormControl(),
    username_control: new FormControl(),
    // nplot_control: new FormControl()
  });
  loading = true;
  filterExpanded;
  sessions;
  allSessions;

  showSortedSessions = false;
  selectedTaskType: string = 'audio delay';
  sessionDateFilter: Function;
  // miceBirthdayFilter: Function;
  sessionMinDate: Date;
  sessionMaxDate: Date;
  dateRangeToggle: boolean;
  filteredClusteringMethodsOptions: Observable<string[]>;
  filteredSessionOptions: Observable<string[]>;
  filteredProbeCountOptions: Observable<string[]>;
  filteredSubjectIdOptions: Observable<string[]>;
  filteredInsertLocationsOptions: Observable<string[]>;
  filteredWaterRestrictionNumberOptions: Observable<string[]>;
  filteredUsernameOptions: Observable<string[]>;
  session_menu: any;
  // setup for the table columns
  // displayedColumns: string[] = ['probe_count', 'subject_id', 'subject_birth_date', 'session_date',
  //                             'clustering_methods', 'water_restriction_number', 'username',
  //                             'session', 'sex', 'insert_locations'];
  displayedColumns: string[] = ['subject_id', 'water_restriction_number', 'session', 'session_date', 'username',
    'probe_count', 'insert_locations', 'clustering_methods',
    'quality_control', 'manual_curation', 'tracking_avai', 'histology_avai'];

  // setup for the paginator
  dataSource;
  pageSize = 25;
  pageSizeOptions: number[] = [10, 25, 50, 100];

  // queryValues = {
  //   'clustering_methods': '_iblrig_tasks_habituationChoiceWorld3.7.6',
  //   // '__order': 'session_date'
  // };

  // genderForm2MenuMap = { F: 0, M: 1, U: 2 };
  checkmarkMap: any = {'0': '', '1': '\u2714'};

  selectedSession = {};

  private sessionsSubscription: Subscription;
  private sessionMenuSubscription: Subscription;
  private allSessionMenuSubscription: Subscription;
  private reqSessionsSubscription: Subscription;

  constructor(private route: ActivatedRoute, private router: Router, public allSessionsService: AllSessionsService, public filterStoreService: FilterStoreService) {}
  // @Input('preRestriction') preRestrictedMouseInfo: Object;
  @ViewChild(MatSort) sort: MatSort;
  @ViewChild(MatPaginator) paginator: MatPaginator;
  ngOnInit() {
    this.session_menu = {};
    this.loading = true;
    this.session_menu['sex'] = { F: null, M: null, U: null };
    if (window.innerWidth < 1250 || window.innerHeight < 750) {
      this.filterExpanded = false;
    } else {
      this.filterExpanded = true;
    }
    const tableState: [number, number, Object] = this.filterStoreService.retrieveSessionTableState();
    this.route.queryParams
      .subscribe(params => {
        // console.log('params loading sessions: ', params);
        if (Object.entries(params).length === 0) {
          params = this.filterStoreService.retrieveSessionFilter();
          if (!params) {
            params = {};
            this.updateMenu();
          }
        }
        for (const key in params) {
          if (key === '__json') {
            // console.log('inside __json filter');
            // console.log('params[key] is', params[key]);
            const JSONcontent = JSON.parse(params[key]);
            const dateRange = ['', ''];
            for (const item of JSONcontent) {
              if (typeof item === 'string') {
                 // item = "session_date>'2019-04-24T00:00:00'"
                if (item.split('>')[1]) {
                  dateRange[0] = item.split('>')[1].split('T')[0].split('\'')[1];
                }
                if (item.split('<')[1]) {
                  dateRange[1] = item.split('<')[1].split('T')[0].split('\'')[1];
                }

              } else {
                // for (const gender of item) {
                //   this.session_filter_form.controls.sex_control['controls'][this.genderForm2MenuMap[gender['sex']]].patchValue(true);
                // }
              }
            }
            if (dateRange[0] !== '' && dateRange[0] === dateRange[1]) {
              this.dateRangeToggle = false;
              this.session_filter_form.controls.session_date_control.patchValue(moment.utc(dateRange[0]));
            } else if (dateRange[0] !== '') {
              this.dateRangeToggle = true;
              this.session_filter_form.controls.session_range_filter['controls'].session_range_start_control.patchValue(moment.utc(dateRange[0]));
              this.session_filter_form.controls.session_range_filter['controls'].session_range_end_control.patchValue(moment.utc(dateRange[1]));
            }
          } else if (key === 'sex') {
            // this.session_filter_form.controls.sex_control['controls'][this.genderForm2MenuMap[params[key]]].patchValue(true);
          } else if (key === 'subject_birth_date') {
            // this.session_filter_form.controls.subject_birth_date_control.patchValue(moment.utc(params[key]));
          } else if ( key !== 'session_date' && key !== '__json' && key !== '__order') {
            const controlName = key + '_control';
            if (this.session_filter_form.controls[controlName]) {
              const toPatch = {};
              toPatch[controlName] = params[key];
              this.session_filter_form.patchValue(toPatch);
            }
          }
        }
        if (tableState[1]) {
          this.paginator.pageIndex = tableState[0];
          this.pageSize = tableState[1];
        }
        if (tableState[2] && Object.entries(tableState[2]).length > 0 && this.sort) {
          this.sort.active = Object.keys(tableState[2])[0];
          this.sort.direction = Object.values(tableState[2])[0].direction;
        }
        this.applyFilter();

      });
    // TODO: create menu content using separate api designated for menu instead of getting all session info
    this.allSessionsService.getAllSessionMenu({'__order': 'subject_id'});
    this.allSessionMenuSubscription = this.allSessionsService.getAllSessionMenuLoadedListener()
      .subscribe((sessions_all: any) => {
        this.allSessions = sessions_all;
        this.sessions = sessions_all;
        this.applyToggleFilter();
        this.createMenu(sessions_all);
      });
  }

  ngOnDestroy() {
    if (this.sessionsSubscription) {
      this.sessionsSubscription.unsubscribe();
    }
    if (this.reqSessionsSubscription) {
      this.reqSessionsSubscription.unsubscribe();
    }
    if (this.sessionMenuSubscription) {
      this.sessionMenuSubscription.unsubscribe();
    }
    if (this.allSessionMenuSubscription) {
      this.allSessionMenuSubscription.unsubscribe();
    }
  }

  private createMenu(sessions) {
    this.session_menu = {};
    // const keys = ['clustering_methods', 'session_date',
    // 'session', 'probe_count', 'subject_birth_date', 'water_restriction_number',
    // 'sex', 'subject_id', 'username', 'insert_locations'];
    const keys = ['session_date',
      'session', 'water_restriction_number',
      'subject_id', 'username', 'probe_count', 'insert_locations', 'clustering_methods'];
    for (const key of keys) {
      if (key !== 'sex') {
        this.session_menu[key] = [];
      } else {
        this.session_menu[key] = { F: false, M: false, U: false };
      }
    }
    for (const session of sessions) {
      for (const key of keys) {
        if (key !== 'sex' && key !== 'insert_locations' && key !== 'clustering_methods' && (session[key] || session[key] === 0) && !this.session_menu[key].includes(session[key].toString())) {
          this.session_menu[key].push(session[key].toString());

        } else if (key === 'sex') {
          // console.log('creating sex menu - looking at ', this.session_menu[key], ' and ', session[key]);
          if (Object.keys(this.session_menu[key]).includes(session[key]) && !this.session_menu[key][session[key]]) {
            this.session_menu[key][session[key]] = true;
          }
        } else if (key === 'insert_locations' || key === 'clustering_methods') {
          if (session[key] && session[key].split(',').length === 1 && !this.session_menu[key].includes(session[key])) {
            this.session_menu[key].push(session[key]);
          } else if (session[key] && session[key].split(',').length > 1) {
            for (const itemOption of session[key].split(',')) {
              if (!this.session_menu[key].includes(itemOption)) {
                this.session_menu[key].push(itemOption);
              }
            }
          }
        }
      }
    }
    // console.log('printing session_menu: ', this.session_menu);


    // for (const item in this.session_menu['sex']) {
    //   if (!this.session_menu['sex'][item]) {
    //     this.session_filter_form.controls.sex_control['controls'][this.genderForm2MenuMap[item]].patchValue(false);
    //     this.session_filter_form.controls.sex_control['controls'][this.genderForm2MenuMap[item]].disable();
    //   } else {
    //     this.session_filter_form.controls.sex_control['controls'][this.genderForm2MenuMap[item]].enable();
    //   }
    // }

    const sessionSeconds = [];
    for (const date of this.session_menu['session_date']) {
      sessionSeconds.push(new Date(date).getTime());
    }
    this.sessionMinDate = new Date(Math.min(...sessionSeconds));
    this.sessionMaxDate = new Date(Math.max(...sessionSeconds));

    this.filteredProbeCountOptions = this.session_filter_form.controls.probe_count_control.valueChanges
      .pipe(
        startWith(''),
        map(value => this._filter(value, 'probe_count'))
      );

    this.filteredSubjectIdOptions = this.session_filter_form.controls.subject_id_control.valueChanges
      .pipe(
        startWith(''),
        map(value => this._filter(value, 'subject_id'))
      );

    this.filteredInsertLocationsOptions = this.session_filter_form.controls.insert_locations_control.valueChanges
      .pipe(
        startWith(''),
        map(value => this._filter(value, 'insert_locations'))
      );

    this.filteredSessionOptions = this.session_filter_form.controls.session_control.valueChanges
      .pipe(
        startWith(''),
        map(value => this._filter(value, 'session'))
      );

    this.filteredClusteringMethodsOptions = this.session_filter_form.controls.clustering_methods_control.valueChanges
      .pipe(
        startWith(''),
        map(value => this._filter(value, 'clustering_methods'))
      );

    this.filteredWaterRestrictionNumberOptions = this.session_filter_form.controls.water_restriction_number_control.valueChanges
      .pipe(
        startWith(''),
        map(value => this._filter(value, 'water_restriction_number'))
      );

    this.filteredUsernameOptions = this.session_filter_form.controls.username_control.valueChanges
      .pipe(
        startWith(''),
        map(value => this._filter(value, 'username'))
      );

    this.sessionDateFilter = (d: Date): boolean => {
      const sessionDates = [];
      for (const date of this.session_menu['session_date']) {
        sessionDates.push(date.split('T')[0]);
      }

      // filter out dates without any session
      return sessionDates.includes(d.toISOString().split('T')[0]);
    };
    // this.miceBirthdayFilter = (d: Date): boolean => {
    //   const birthDates = [];
    //   for (const date of this.session_menu['subject_birth_date']) {
    //     birthDates.push(date);
    //   }
    //   return birthDates.includes(d.toISOString().split('T')[0]);
    // };
  }

  private _filter(value: string, menuType: string): string[] {
    const filterValue = value.toString().toLowerCase();
    console.log('logging filterValue:', filterValue);
    const result =  this.session_menu[menuType].filter(menu_items => {
      if (menu_items && menu_items.toLowerCase().includes(filterValue)) {
        return true;
      }
    });
    return result;

  }

  updateMenu() {

    const menuRequest = this.filterRequests();
    if (Object.entries(menuRequest).length > 1) {
      menuRequest['order__'] = 'subject_id';
      this.allSessionsService.getSessionMenu(menuRequest);
      this.allSessionsService.getSessionMenuLoadedListener()
        .subscribe((sessions: any) => {
          this.createMenu(sessions);
        });
    }
  }

  stepBackMenu(event) {
    let focusOn: string;
    if (event.checked) {
      focusOn = 'sex';
    } else {
      focusOn = event.target.name;
    }
    const referenceMenuReq = this.filterRequests(focusOn);
    if (Object.entries(referenceMenuReq) && Object.entries(referenceMenuReq).length > 0) {
      referenceMenuReq['order__'] = 'subject_id';
      this.allSessionsService.getSessionMenu(referenceMenuReq);
      this.allSessionsService.getSessionMenuLoadedListener()
        .subscribe((sessions: any) => {
          this.createMenu(sessions);
        });
    } else {
      this.createMenu(this.allSessions);
    }

  }
  // genderSelected(genderForm) {
  //   return genderForm.includes(true);
  // }

  filterRequests(focusedField?: string) {
    const filterList = Object.entries(this.session_filter_form.getRawValue());
    const requestFilter = {};
    let requestJSONstring = '';
    filterList.forEach(filter => {
      // filter is [["probe_count_control", "somelab"], ["subject_id_control", null]...]
      const filterKey = filter[0].split('_control')[0]; // filter[0] is control name like 'probe_count_control'
      if (filter[1] && filterKey !== focusedField) {
        // if (filterKey === 'sex' && this.genderSelected(filter[1])) {
        //   let requestedGender: string;
        //   const requestGenderArray = [];
        //   for (const index in filter[1]) {
        //     if (filter[1][index]) {
        //       requestedGender = Object.keys(this.session_menu['sex'])[index];
        //       // console.log('type of JSON.stringify({sex: requestedGender}) is: ', typeof JSON.stringify({ 'sex': requestedGender}));
        //       requestGenderArray.push(JSON.stringify({ 'sex': requestedGender}));
        //       // requestedGender = this.session_menu['sex'][index];
        //     }
        //   }
        //   if (requestJSONstring.length > 0) {
        //     requestJSONstring += ',' + '[' + requestGenderArray + ']';
        //   } else {
        //     requestJSONstring += '[' + requestGenderArray + ']';
        //   }

        //   // requestFilter['__json'] = '[' + requestGenderArray + ']';
        if (filterKey === 'sex') {
          //
        } else if (filterKey !== 'sex') {
          // making sure gender filter gets removed from the request

          if (filterKey === 'subject_birth_date') {
            // // Tue Dec 11 2018 00:00:00 GMT-0600 (Central Standard Time) => 2018-12-11T06:00:00.000Z => 2018-12-11
            // const mouseDOB = moment.utc(filter[1]);
            // if (mouseDOB.toISOString()) {
            //   requestFilter[filterKey] = mouseDOB.toISOString().split('T')[0];
            // }
          } else if (filterKey === 'session_date') {
              if (!this.dateRangeToggle) {
                const sessionST = moment.utc(filter[1].toString());
                const rangeStartTime = '00:00:00';
                const rangeEndTime = '23:59:59';
                const startString = sessionST.toISOString().split('T')[0] + 'T' + rangeStartTime;
                const endString = sessionST.toISOString().split('T')[0] + 'T' + rangeEndTime;
                const rangeStart = '"' + 'session_date>' + '\'' + startString + '\'' + '"';
                const rangeEnd = '"' + 'session_date<' + '\'' + endString + '\'' + '"';
                if (requestJSONstring.length > 0) {
                  requestJSONstring += ',' + rangeStart + ',' + rangeEnd;
                } else {
                  requestJSONstring += rangeStart + ',' + rangeEnd;
                }
              }
          } else if (filterKey === 'session_range_filter') {
            //// Note: filter =
            ////      ["session_range_filter", { session_range_start_control: null, session_range_end_control: null }]
            if (this.dateRangeToggle && filter[1]['session_range_start_control'] && filter[1]['session_range_end_control']) {

              const sessionStart = moment.utc(filter[1]['session_range_start_control'].toString());
              const sessionEnd = moment.utc(filter[1]['session_range_end_control'].toString());
                const rangeStartTime = '00:00:00';
                const rangeEndTime = '23:59:59';
                const startString = sessionStart.toISOString().split('T')[0] + 'T' + rangeStartTime;
                const endString = sessionEnd.toISOString().split('T')[0] + 'T' + rangeEndTime;
                const rangeStart = '"' + 'session_date>' + '\'' + startString + '\'' + '"';
                const rangeEnd = '"' + 'session_date<' + '\'' + endString + '\'' + '"';
                if (requestJSONstring.length > 0) {
                  requestJSONstring += ',' + rangeStart + ',' + rangeEnd;
                } else {
                  requestJSONstring += rangeStart + ',' + rangeEnd;
                }
            } else if (this.dateRangeToggle && filter[1]['session_range_start_control'] && !filter[1]['session_range_end_control']) {
                // console.log('all session from ', filter[1]['session_range_start_control'], ' requested!');
              const sessionStart = moment.utc(filter[1]['session_range_start_control'].toString());
                const rangeStartTime = '00:00:00';
                const startString = sessionStart.toISOString().split('T')[0] + 'T' + rangeStartTime;
                const rangeStart = '"' + 'session_date>' + '\'' + startString + '\'' + '"';
                if (requestJSONstring.length > 0) {
                  requestJSONstring += ',' + rangeStart;
                } else {
                  requestJSONstring += rangeStart;
                }
            } else if (this.dateRangeToggle && !filter[1]['session_range_start_control'] && filter[1]['session_range_end_control']) {
                // console.log('all session up to ', filter[1]['session_range_end_control'], ' requested!');
              const sessionEnd = moment.utc(filter[1]['session_range_end_control'].toString());
                const rangeEndTime = '23:59:59';
                const endString = sessionEnd.toISOString().split('T')[0] + 'T' + rangeEndTime;
                const rangeEnd = '"' + 'session_date<' + '\'' + endString + '\'' + '"';
                if (requestJSONstring.length > 0) {
                  requestJSONstring += ',' + rangeEnd;
                } else {
                  requestJSONstring += rangeEnd;
                }
            }
          } else if (filterKey === 'nplot') {
              // filter[1] ? requestFilter[filterKey] = 1 : requestFilter[filterKey] = 0;
          } else {
            requestFilter[filterKey] = filter[1];
          }
        }

        if (requestJSONstring.length > 0) {
          requestFilter['__json'] = '[' + requestJSONstring + ']';
        }
      }
    });
    return requestFilter;
  }

  applyFilter() {
    this.loading = true;
    this.sessions = [];
    const request = this.filterRequests();
    // console.log('applying filter with...', request);
    request['__order'] = 'session_date DESC';
    if (Object.entries(request) && Object.entries(request).length > 1) {
      this.filterStoreService.storeSessionFilter(request);
      this.allSessionsService.retrieveSessions2(request);
      this.reqSessionsSubscription = this.allSessionsService.getNewSessionsLoadedListener2()
        .subscribe((newSessions: any) => {
          // console.log('response: ', newSessions);
          this.loading = false;
          this.sessions = newSessions;
          this.applyToggleFilter();
        });
    } else {
      this.resetFilter();
    }
  }

  resetFilter() {
    // console.log('resetting filter');
    this.loading = true;
    this.allSessionsService.retrieveSessions({ '__order': 'session_date DESC'});
    // this.allSessionsService.retrieveSessions({});
    this.filterStoreService.clearSessionFilter();
    this.allSessionsService.getNewSessionsLoadedListener()
      .subscribe((sessionsAll: any) => {
        this.loading = false;
        this.sessions = sessionsAll;
        this.allSessions = sessionsAll;
        this.applyToggleFilter();
      });
  }

  clearControl() {
    for (const control in this.session_filter_form.controls) {
      const toReset = {}

      if (control === 'session_range_filter') {
        toReset[control] = { 'session_range_start_control': null, 'session_range_end_control': null}

      } else if (control === 'sex_control') {
        toReset[control] = [false, false, false];
        for (const index in this.session_filter_form.get(control)['controls']) {
          this.session_filter_form.get(control).get([index]).enable();
        }
      } else {
        toReset[control] = '';
      }
      this.session_filter_form.patchValue(toReset);
    }
    this.filterStoreService.clearSessionTableState();
    this.paginator.pageSize = 25;
    this.paginator.pageIndex = null;
    // the below sort is to reset the arrow UI that doesn't go away after this.sort.active = ''
    this.sort.sortables.forEach(sortItem => {
      this.sort.sort(sortItem);
    });

    this.sort.active = '';

    // console.log(this.route.queryParams);
    this.route.queryParams.subscribe(param => {
      if (Object.keys(param).length > 0) {
        this.router.navigate(
          [],
          {
            relativeTo: this.route,
            queryParams: null
          });
      } else {
        this.applyFilter();
      }
     });
  }

  storeTableInfo(event) {
    let pageIndex;
    let pageSize;
    const sorter = {};
    if (event.pageSize) {
      pageIndex = event.pageIndex;
      pageSize = event.pageSize;
    }
    if (event.active && event.direction) {
      if (event.active !== 'nplot') {
        sorter[event.active] = { 'direction': event.direction };
      }
    }
    this.filterStoreService.storeSessionTableState(pageIndex, pageSize, sorter);
  }

  sessionSelected(session) {
    // console.log(session);
    this.selectedSession = session;
  }

  toggleSortedSessionViewStatus() {
    // console.log('show sorted sessions: ', this.showSortedSessions);
    this.showSortedSessions = !this.showSortedSessions;
    this.applyToggleFilter();
  }

  applyToggleFilter() {
    const sortedSessions = [];
      for (const session of this.sessions) {
        let is_selected_task = true

        if (this.selectedTaskType == 'all') {
          is_selected_task = true
        } else {
          is_selected_task = session['task'].startsWith(this.selectedTaskType);
        }

        let is_sorted_only = this.showSortedSessions ? (session['clustering_methods'] && session['clustering_methods'].length > 0) : true;

        if (is_selected_task && is_sorted_only) {
          sortedSessions.push(session);
        }
      }
    this.dataSource = new MatTableDataSource(sortedSessions);
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (data, header) => data[header];
    this.dataSource.paginator = this.paginator;
  }

}
