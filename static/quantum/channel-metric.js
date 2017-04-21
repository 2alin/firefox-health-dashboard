/* global fetch */
import 'babel-polyfill';
import React from 'react';
import cx from 'classnames';
// import moment from 'moment';
import { curveLinear, line, scaleTime, scaleLinear, scalePow, scaleBand } from 'd3';
import Dashboard from './../dashboard';

export default class ChannelMetric extends React.Component {
  state = {};

  componentDidMount() {
    this.fetch();
    if (this.target) {
      const rect = this.target.getBoundingClientRect();
      this.width = rect.width;
      this.height = rect.height;
    }
  }

  height = 0;
  width = 0;

  async fetch() {
    const raw = await Promise.all([
      /* eslint-disable max-len */
      fetch(`/api/perf/version-evolutions?${this.props.query}`),
      /* eslint-enable max-len */
    ]);
    const [evolutions] = await Promise.all(
      raw.map(buffer => buffer.json()),
    );
    this.setState({ evolutions });
  }

  render() {
    const { builds, evolutions } = this.state;
    let svg = null;

    if (evolutions) {
      const yRange = [Number.MAX_VALUE, Number.MIN_VALUE];
      const yRanges = {
        p50Avg: [Number.MAX_VALUE, Number.MIN_VALUE],
        p95Avg: [Number.MAX_VALUE, Number.MIN_VALUE],
      };
      const yRangeFields = Object.keys(yRanges);
      evolutions.forEach((version) => {
        version.channels.forEach((channel) => {
          channel.dates.forEach((date) => {
            yRangeFields.forEach((field) => {
              if (yRanges[field][0] > date[field]) {
                yRanges[field][0] = date[field];
              } else if (yRanges[field][1] < date[field]) {
                yRanges[field][1] = date[field];
              }
              if (yRange[0] > date[field]) {
                yRange[0] = date[field];
              } else if (yRange[1] < date[field]) {
                yRange[1] = date[field];
              }
            });
          });
        });
      });
      const yBandScale = scaleBand()
        .domain(yRangeFields)
        .padding(0.1)
        .range([this.height, 0]);
      const yScales = yRangeFields.reduce((map, field) => {
        const band = yBandScale(field);
        const xScale = scaleLinear()
          // .exponent(0.5)
          .domain(yRanges[field])
          .nice(10)
          .range([band + yBandScale.bandwidth(), band]);
        return map.set(field, xScale);
      }, new Map());
      const alphaScale = scalePow()
        .exponent(0.5)
        .domain([0, 2])
        .range([1, 0.25]);
      const xDomain = [
        // first day of release for oldest version
        new Date(evolutions.slice(-1)[0].channels.slice(-3)[0].dates[0].date),
        // last day of current nightly
        new Date(evolutions[0].channels[0].dates.slice(-1)[0].date),
      ];
      const xScale = scaleTime()
        .domain(xDomain)
        .range([50, this.width - 5]);
      const $evolutions = evolutions.map((version, versionIdx) => {
        // console.log(moment(xDomain[1]).diff(xDomain[0], 'weeks', true));
        const paths = yRangeFields.reduce((map, field) => {
          return map.set(field, line()
            .x(d => xScale(new Date(d.date)))
            .y(d => yScales.get(field)(d[field]))
            .curve(curveLinear));
        }, new Map());
        const $channels = version.channels.map((channel, channelIdx) => {
          const alpha = alphaScale(channelIdx);
          const latest = (versionIdx === 0);
          return [...paths].map(([field, path], pathIdx) => {
            const color = pathIdx ? '#B6D806' : '#FF8C8E';
            const $label = (channel.channel === 'nightly')
              ? (
                <text
                  x={xScale(new Date(channel.dates[0].date))}
                  y={yScales.get(field)(new Date(channel.dates[0][field]))}
                  stroke={color}
                >
                  {`${version.version}/${channel.channel}`}
                </text>
              )
              : null;
            return (
              <g
                key={`${versionIdx}-${channelIdx}-${pathIdx}`}
                className='channel-line'
              >
                {$label}
                <path
                  stroke={color}
                  strokeWidth={latest ? 2 : 1}
                  strokeOpacity={alpha}
                  d={path(channel.dates)}
                />
              </g>
            );
          });
        });
        return (
          <g key={`${versionIdx}`}>
            {$channels}
          </g>
        );
      });
      const $ticks = [...yScales].map(([field, yScale]) => {
        return yScale.ticks(10).map((tick, idx) => {
          const y = yScale(tick);
          return (
            <g className={cx('tick', { 'tick-axis': idx === 0, 'tick-secondary': idx > 0 })} key={`tick-${tick}`}>
              <line
                x1={50}
                y1={y}
                x2={this.width}
                y2={y}
              />
              <text
                x={40}
                y={y}
              >
                {tick}
              </text>
            </g>
          );
        });
      });
      const fieldLabels = {
        p50Avg: '50th Percentile',
        p95Avg: '95th Percentile',
      };
      const $fields = yRangeFields.map((field) => {
        const label = fieldLabels[field] || field;
        const y = yBandScale(field);
        // transform={`translate(${20}, ${y + 100}) rotate(-90)`}
        return (
          <g className={cx('title')} key={`title-${field}`}>
            <text
              transform={`translate(${75}, ${y + 10})`}
            >
              {label}
            </text>
          </g>
        );
      });
      svg = (
        <svg
          height={this.height}
          width={this.width}
        >
          {$ticks}
          {$fields}
          {$evolutions}
        </svg>
      );
    } else {
      svg = 'Loading …';
    }

    const cls = cx('graphic-timeline', {
      'state-loading': !builds,
    });

    return (
      <Dashboard
        title={`Quantum Performance: ${this.props.title}`}
        subtitle={this.props.subtitle}
        className='dashboard-metric'
      >
        <section
          className={cls}
          ref={target => (this.target = target)}
        >
          {svg}
        </section>
      </Dashboard>
    );
  }
}

ChannelMetric.defaultProps = {
  query: '',
  title: '',
  subtitle: '',
};
ChannelMetric.propTypes = {
  query: React.PropTypes.string,
  title: React.PropTypes.string,
  subtitle: React.PropTypes.string,
};
